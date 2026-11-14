/**
 * Study workflow: create → upload images → AI analysis → doctor review & signature.
 * Route handlers stay thin; all rules (access, immutability, audit) live here.
 */
import type { Prisma, Recommendation } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { canAccessPatient, can, type Actor } from "../access";
import { audit } from "../audit";
import { sha256 } from "../crypto";
import { storage, newImageKey, sniffType } from "../storage";
import { analyzeImages, convertDicom, type AiNodule } from "../ai-client";
import { scoreTirads, riskFromLevel, isSignificantGrowth, ellipsoidVolumeMl } from "../tirads";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_IMAGES_PER_STUDY = 8;

/** Loads a study and enforces patient-level access. 404 (not 403) to avoid leaking existence. */
export async function getStudyForActor(actor: Actor, studyId: string) {
  const study = await db.ultrasoundStudy.findFirst({ where: { id: studyId, deletedAt: null } });
  if (!study || !(await canAccessPatient(actor, study.patientId))) throw new HttpError(404, "الفحص غير موجود");
  return study;
}

// ---------- Create study ----------

export const createStudySchema = z.object({
  studyDate: z.coerce.date().max(new Date(Date.now() + 86_400_000), "تاريخ الفحص لا يمكن أن يكون في المستقبل"),
  indication: z.string().trim().max(500).optional(),
  device: z.string().trim().max(120).optional(),
});

export async function createStudy(actor: Actor, patientId: string, input: z.infer<typeof createStudySchema>) {
  if (!can.uploadImaging(actor.role)) throw new HttpError(403, "ليس لديك صلاحية رفع الإشاعات");
  if (!(await canAccessPatient(actor, patientId))) throw new HttpError(404, "المريض غير موجود");
  const doctor = await db.doctorProfile.findUnique({ where: { userId: actor.id } });
  const year = new Date().getFullYear();
  const count = await db.ultrasoundStudy.count({ where: { accession: { startsWith: `US-${year}-` } } });
  const study = await db.ultrasoundStudy.create({
    data: {
      patientId,
      orderedById: doctor?.id,
      accession: `US-${year}-${String(count + 1).padStart(4, "0")}`,
      studyDate: input.studyDate,
      indication: input.indication,
      device: input.device,
    },
  });
  await audit({ actorId: actor.id, action: "STUDY_CREATE", entityType: "UltrasoundStudy", entityId: study.id });
  return study;
}

// ---------- Upload images ----------

function pngSize(buf: Buffer) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

export async function addImages(
  actor: Actor,
  studyId: string,
  files: { data: Buffer; view: string; pixelSpacingMm: number | null }[],
) {
  if (!can.uploadImaging(actor.role)) throw new HttpError(403, "ليس لديك صلاحية رفع الإشاعات");
  const study = await getStudyForActor(actor, studyId);
  if (study.status === "REVIEWED" || study.status === "REPORTED") throw new HttpError(409, "لا يمكن إضافة صور لفحص تم اعتماده");
  const existing = await db.ultrasoundImage.count({ where: { studyId, deletedAt: null } });
  if (existing + files.length > MAX_IMAGES_PER_STUDY) throw new HttpError(400, `الحد الأقصى ${MAX_IMAGES_PER_STUDY} صور لكل فحص`);

  const created = [];
  for (const f of files) {
    if (f.data.length > MAX_FILE_BYTES) throw new HttpError(413, "حجم الملف أكبر من 15 ميجابايت");
    const type = sniffType(f.data);
    if (type !== "png" && type !== "jpg" && type !== "dicom") throw new HttpError(415, "نوع الملف غير مدعوم. المسموح: DICOM أو PNG أو JPG");

    let data = f.data;
    let spacing = f.pixelSpacingMm;
    let width: number | null = null;
    let height: number | null = null;
    let ext: "png" | "jpg" = type === "jpg" ? "jpg" : "png";

    if (type === "dicom") {
      // Convert to PNG in the AI service; only pixels + calibration are kept (patient tags dropped)
      const conv = await convertDicom(f.data);
      data = Buffer.from(conv.png_base64, "base64");
      spacing = spacing ?? conv.pixel_spacing_mm;
      width = conv.width;
      height = conv.height;
      ext = "png";
    } else if (type === "png") {
      ({ width, height } = pngSize(data));
    }

    const key = newImageKey(studyId, ext);
    await storage.put(key, data);
    created.push(
      await db.ultrasoundImage.create({
        data: {
          studyId,
          storageKey: key,
          mimeType: ext === "png" ? "image/png" : "image/jpeg",
          width,
          height,
          pixelSpacingMm: spacing,
          isDicom: type === "dicom",
          view: f.view === "TRANSVERSE" || f.view === "SAGITTAL" ? f.view : "UNKNOWN",
        },
      }),
    );
  }
  await audit({ actorId: actor.id, action: "IMAGES_UPLOAD", entityType: "UltrasoundStudy", entityId: studyId, meta: { count: created.length } });
  return created;
}

// ---------- AI analysis ----------

export async function runAnalysis(actor: Actor, studyId: string) {
  if (!can.uploadImaging(actor.role)) throw new HttpError(403, "ليس لديك صلاحية تشغيل التحليل");
  const study = await getStudyForActor(actor, studyId);
  if (study.status === "REVIEWED" || study.status === "REPORTED") throw new HttpError(409, "الفحص معتمد بالفعل");
  if (study.status === "ANALYZING") throw new HttpError(409, "التحليل قيد التنفيذ");

  const images = await db.ultrasoundImage.findMany({ where: { studyId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  if (!images.length) throw new HttpError(400, "ارفع صورة واحدة على الأقل قبل التحليل");

  await db.ultrasoundStudy.update({ where: { id: studyId }, data: { status: "ANALYZING" } });
  let result;
  try {
    const payload = await Promise.all(
      images.map(async (img) => ({ data: await storage.get(img.storageKey), name: img.id, view: img.view, pixelSpacingMm: img.pixelSpacingMm })),
    );
    result = await analyzeImages(payload);
  } catch (e) {
    await db.ultrasoundStudy.update({ where: { id: studyId }, data: { status: "UPLOADED" } });
    throw new HttpError(502, (e as Error).message);
  }

  const analysis = await db.$transaction(async (tx) => {
    const a = await tx.aIAnalysisResult.create({
      data: {
        studyId,
        modelVersion: result.model_version,
        imageQuality: result.image_quality,
        warnings: result.warnings,
        durationMs: result.duration_ms,
        rawOutput: result as unknown as Prisma.InputJsonValue, // immutable original
      },
    });
    for (const n of result.nodules) {
      const nodule = await matchOrCreateNodule(tx, study.patientId, n);
      await tx.noduleFinding.create({ data: findingFromAi(a.id, nodule.id, images[n.image_index]?.id ?? null, n) });
    }
    await tx.ultrasoundStudy.update({ where: { id: studyId }, data: { status: "ANALYZED" } });
    return a;
  });

  await notifyAfterAnalysis(actor, study.patientId, studyId, result.nodules);
  await audit({
    actorId: actor.id,
    action: "AI_ANALYZE",
    entityType: "UltrasoundStudy",
    entityId: studyId,
    meta: { analysisId: analysis.id, nodules: result.nodules.length, model: result.model_version },
  });
  return { analysisId: analysis.id, nodules: result.nodules.length, warnings: result.warnings };
}

/** Same lobe (+ zone when possible) = same nodule across studies, so growth can be tracked. */
async function matchOrCreateNodule(tx: Prisma.TransactionClient, patientId: string, n: AiNodule) {
  const existing = await tx.nodule.findMany({ where: { patientId, lobe: n.lobe } });
  const match = existing.find((x) => x.zone === n.zone) ?? (existing.length === 1 ? existing[0] : undefined);
  if (match) return match;
  const count = await tx.nodule.count({ where: { patientId } });
  return tx.nodule.create({ data: { patientId, label: `N${count + 1}`, lobe: n.lobe, zone: n.zone } });
}

function findingFromAi(analysisId: string, noduleId: string, imageId: string | null, n: AiNodule): Prisma.NoduleFindingUncheckedCreateInput {
  return {
    analysisId,
    noduleId,
    imageId,
    lobe: n.lobe,
    zone: n.zone,
    nearCapsule: n.near_capsule,
    bbox: n.bbox,
    contour: n.contour,
    lengthMm: n.length_mm,
    widthMm: n.width_mm,
    depthMm: n.depth_mm,
    volumeMl: n.volume_ml,
    composition: n.composition,
    echogenicity: n.echogenicity,
    shape: n.shape,
    margin: n.margin,
    echogenicFoci: n.echogenic_foci,
    tiradsPoints: n.tirads_points,
    tiradsLevel: n.tirads_level,
    risk: n.risk,
    malignancyProb: n.malignancy_prob,
    confidence: n.confidence,
    explanation: n.explanation,
  };
}

async function notifyAfterAnalysis(actor: Actor, patientId: string, studyId: string, nodules: AiNodule[]) {
  const patient = await db.patient.findUnique({
    where: { id: patientId },
    select: { mrn: true, assignments: { where: { isPrimary: true }, select: { doctor: { select: { userId: true } } } } },
  });
  const recipients = new Set([actor.id, ...(patient?.assignments.map((a) => a.doctor.userId) ?? [])]);
  const link = `/doctor/studies/${studyId}`;
  const notes: Prisma.NotificationCreateManyInput[] = [];
  for (const userId of recipients) {
    notes.push({ userId, type: "ANALYSIS_DONE", title: "تحليل جاهز للمراجعة", body: `ملف ${patient?.mrn}: ${nodules.length ? `${nodules.length} عقدة` : "لم تُكتشف عقدة"}`, link });
    if (nodules.some((n) => n.risk === "HIGH" || n.risk === "SUSPICIOUS"))
      notes.push({ userId, type: "HIGH_RISK", title: "نتيجة AI عالية الخطورة", body: `ملف ${patient?.mrn} يحتاج مراجعة عاجلة`, link });
  }

  // Growth vs the previous finding of the same nodule
  for (const n of nodules) {
    const prev = await db.noduleFinding.findFirst({
      where: { nodule: { patientId, lobe: n.lobe }, analysis: { studyId: { not: studyId } } },
      orderBy: { analysis: { study: { studyDate: "desc" } } },
    });
    if (
      prev &&
      isSignificantGrowth(
        { l: prev.lengthMm, w: prev.widthMm, d: prev.depthMm, v: prev.volumeMl },
        { l: n.length_mm, w: n.width_mm, d: n.depth_mm, v: n.volume_ml },
      )
    ) {
      for (const userId of recipients)
        notes.push({ userId, type: "GROWTH_ALERT", title: "زيادة ملحوظة في حجم العقدة", body: `ملف ${patient?.mrn}: زيادة وفق معيار ATA`, link });
    }
  }
  if (notes.length) await db.notification.createMany({ data: notes });
}

// ---------- Doctor review & signature ----------

const point = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);

export const reviewSchema = z
  .object({
    decision: z.enum(["CONFIRMED", "MODIFIED", "REJECTED"]),
    findingId: z.string().uuid().optional(),
    features: z
      .object({
        composition: z.enum(["CYSTIC", "SPONGIFORM", "MIXED", "SOLID"]),
        echogenicity: z.enum(["ANECHOIC", "HYPERECHOIC", "ISOECHOIC", "HYPOECHOIC", "VERY_HYPOECHOIC"]),
        shape: z.enum(["WIDER_THAN_TALL", "TALLER_THAN_WIDE"]),
        margin: z.enum(["SMOOTH", "ILL_DEFINED", "LOBULATED", "EXTRATHYROIDAL"]),
        echogenicFoci: z.array(z.enum(["NONE", "COMET_TAIL", "MACRO", "RIM", "PUNCTATE"])).min(1).max(4),
      })
      .optional(),
    dimensions: z.object({ lengthMm: z.number().positive().max(150), widthMm: z.number().positive().max(150), depthMm: z.number().positive().max(150) }).optional(),
    contour: z.array(point).min(3).max(200).optional(),
    recommendation: z.enum(["ROUTINE_FOLLOW_UP", "US_FOLLOW_UP", "FNA", "ADDITIONAL_IMAGING", "LAB_TESTS", "SURGICAL_REFERRAL", "NO_ACTION"]),
    clinicalNotes: z.string().trim().max(4000).optional(),
    changeReason: z.string().trim().max(1000).optional(),
  })
  .refine((r) => r.decision === "CONFIRMED" || (r.changeReason?.length ?? 0) >= 5, {
    message: "اكتب سبب التعديل أو الرفض (5 أحرف على الأقل)",
    path: ["changeReason"],
  });

export async function submitReview(actor: Actor, analysisId: string, input: z.infer<typeof reviewSchema>, ip: string | null) {
  if (!can.reviewAnalysis(actor.role)) throw new HttpError(403, "المراجعة متاحة للأطباء وأخصائيي الأشعة فقط");
  const analysis = await db.aIAnalysisResult.findUnique({ where: { id: analysisId }, include: { findings: true, review: true, study: true } });
  if (!analysis || !(await canAccessPatient(actor, analysis.study.patientId))) throw new HttpError(404, "التحليل غير موجود");
  if (analysis.review) throw new HttpError(409, "تم اعتماد هذا التحليل بالفعل، والتقارير المعتمدة لا تُعدَّل");

  const finding = analysis.findings.find((f) => f.id === input.findingId) ?? analysis.findings[0];

  // Final TI-RADS is always recomputed server-side from the final features (never trusted from the client)
  let finalTirads: number | null = null;
  let modifications: Record<string, unknown> | null = null;
  if (input.decision !== "REJECTED" && finding) {
    const f = input.decision === "MODIFIED" && input.features ? input.features : finding;
    finalTirads = scoreTirads({ composition: f.composition, echogenicity: f.echogenicity, shape: f.shape, margin: f.margin, echogenicFoci: f.echogenicFoci }).level;
    if (input.decision === "MODIFIED") {
      const d = input.dimensions;
      modifications = {
        findingId: finding.id,
        ...(input.features ?? {}),
        ...(d ? { ...d, volumeMl: ellipsoidVolumeMl(d.lengthMm, d.widthMm, d.depthMm) } : {}),
        ...(input.contour ? { contour: input.contour } : {}),
        tiradsLevel: finalTirads,
      };
    }
  }

  const signedAt = new Date();
  const signed = {
    analysisId,
    reviewerId: actor.id,
    decision: input.decision,
    finalTirads,
    recommendation: input.recommendation,
    modifications,
    clinicalNotes: input.clinicalNotes ?? null,
    signedAt: signedAt.toISOString(),
  };

  const review = await db.$transaction(async (tx) => {
    const r = await tx.doctorReview.create({
      data: {
        analysisId,
        reviewerId: actor.id,
        decision: input.decision,
        finalTirads,
        finalRisk: finalTirads ? riskFromLevel(finalTirads) : null,
        recommendation: input.recommendation as Recommendation,
        clinicalNotes: input.clinicalNotes,
        changeReason: input.changeReason,
        modifiedFindings: (modifications ?? undefined) as Prisma.InputJsonValue | undefined,
        signedAt,
        signatureHash: sha256(JSON.stringify(signed)), // tamper evidence: any later change breaks the hash
      },
    });
    await tx.report.create({ data: { patientId: analysis.study.patientId, studyId: analysis.studyId, reviewId: r.id, status: "APPROVED" } });
    await tx.ultrasoundStudy.update({ where: { id: analysis.studyId }, data: { status: "REVIEWED" } });
    return r;
  });

  await audit({
    actorId: actor.id,
    action: "REVIEW_SIGN",
    entityType: "AIAnalysisResult",
    entityId: analysisId,
    ip,
    meta: { decision: input.decision, aiLevel: finding?.tiradsLevel ?? null, finalLevel: finalTirads, reviewId: review.id },
  });
  return review;
}
