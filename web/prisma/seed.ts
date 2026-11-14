/**
 * Demo seed — ALL DATA IS FICTIONAL. No real patients.
 * 1 admin · 3 doctors · 1 lab tech · 10 patients · 15 ultrasound studies with AI results, reviews, reports.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import type { Composition, Echogenicity, Shape, Margin, EchogenicFoci, Lobe, LobeZone, Recommendation } from "@prisma/client";
import bcrypt from "bcryptjs";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { scoreTirads, riskFromLevel, ellipsoidVolumeMl, suggestAction } from "../src/lib/tirads";
import { encrypt, sha256 } from "../src/lib/crypto";

const db = new PrismaClient();
const PASSWORD = "Demo@1234";

// Deterministic PRNG so the demo looks the same every time
let s = 42;
const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const jitter = (v: number, pct = 0.08) => +(v * (1 + (rand() * 2 - 1) * pct)).toFixed(1);

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);
const daysAhead = (d: number) => new Date(Date.now() + d * 86_400_000);

/** Ellipse polygon (normalized coords) used as a fake segmentation contour */
function contour(cx: number, cy: number, rx: number, ry: number) {
  return Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    const r = 1 + (rand() - 0.5) * 0.12;
    return [+(cx + Math.cos(a) * rx * r).toFixed(4), +(cy + Math.sin(a) * ry * r).toFixed(4)];
  });
}

const FEATURE_AR: Record<string, string> = {
  CYSTIC: "كيسية", SPONGIFORM: "إسفنجية", MIXED: "مختلطة", SOLID: "صلبة",
  ANECHOIC: "عديمة الصدى", HYPERECHOIC: "عالية الصدى", ISOECHOIC: "متساوية الصدى",
  HYPOECHOIC: "منخفضة الصدى", VERY_HYPOECHOIC: "منخفضة الصدى جدًا",
  WIDER_THAN_TALL: "أعرض من طولها", TALLER_THAN_WIDE: "أطول من عرضها",
  SMOOTH: "ناعمة", ILL_DEFINED: "غير محددة", LOBULATED: "مفصّصة/غير منتظمة", EXTRATHYROIDAL: "امتداد خارج الغدة",
  NONE: "لا يوجد", COMET_TAIL: "ذيل المذنب", MACRO: "تكلسات كبيرة", RIM: "تكلس طرفي", PUNCTATE: "بؤر نقطية",
};

interface NoduleSpec {
  lobe: Lobe;
  zone: LobeZone;
  dims: [number, number, number]; // mm at first study
  growth?: number; // multiplier for 2nd study
  composition: Composition;
  echogenicity: Echogenicity;
  shape: Shape;
  margin: Margin;
  foci: EchogenicFoci[];
}

interface PatientSpec {
  name: string;
  sex: "MALE" | "FEMALE";
  age: number;
  history?: string;
  family?: string;
  meds?: string;
  allergies?: string;
  tsh: number;
  studies: 1 | 2;
  nodule: NoduleSpec;
  pendingReview?: boolean;
}

const patients: PatientSpec[] = [
  { name: "منى عبد الرحمن", sex: "FEMALE", age: 46, history: "قصور غدة درقية منذ 2019", family: "أم مصابة بعقيدات درقية", meds: "Levothyroxine 50mcg", tsh: 3.1, studies: 2,
    nodule: { lobe: "RIGHT", zone: "MIDDLE", dims: [14, 11, 10], growth: 1.32, composition: "SOLID", echogenicity: "HYPOECHOIC", shape: "WIDER_THAN_TALL", margin: "SMOOTH", foci: ["NONE"] } },
  { name: "أحمد فتحي سليمان", sex: "MALE", age: 58, history: "ضغط مرتفع", tsh: 1.8, studies: 2,
    nodule: { lobe: "LEFT", zone: "LOWER", dims: [22, 16, 14], growth: 1.02, composition: "MIXED", echogenicity: "ISOECHOIC", shape: "WIDER_THAN_TALL", margin: "SMOOTH", foci: ["COMET_TAIL"] } },
  { name: "سلمى إبراهيم يوسف", sex: "FEMALE", age: 34, family: "خال مصاب بسرطان الغدة الدرقية الحليمي", tsh: 2.2, studies: 2, pendingReview: true,
    nodule: { lobe: "RIGHT", zone: "UPPER", dims: [11, 9, 12], growth: 1.18, composition: "SOLID", echogenicity: "VERY_HYPOECHOIC", shape: "TALLER_THAN_WIDE", margin: "LOBULATED", foci: ["PUNCTATE"] } },
  { name: "هالة محمود الشريف", sex: "FEMALE", age: 51, history: "التهاب هاشيموتو", meds: "Levothyroxine 75mcg", allergies: "Penicillin", tsh: 5.6, studies: 2,
    nodule: { lobe: "LEFT", zone: "MIDDLE", dims: [9, 7, 6], growth: 1.0, composition: "SPONGIFORM", echogenicity: "ISOECHOIC", shape: "WIDER_THAN_TALL", margin: "SMOOTH", foci: ["NONE"] } },
  { name: "كريم عادل منصور", sex: "MALE", age: 42, tsh: 1.2, studies: 2,
    nodule: { lobe: "ISTHMUS", zone: "MIDDLE", dims: [16, 12, 9], growth: 1.08, composition: "SOLID", echogenicity: "HYPOECHOIC", shape: "WIDER_THAN_TALL", margin: "ILL_DEFINED", foci: ["MACRO"] } },
  { name: "نورهان طارق", sex: "FEMALE", age: 29, tsh: 0.9, studies: 1,
    nodule: { lobe: "RIGHT", zone: "LOWER", dims: [18, 14, 13], composition: "CYSTIC", echogenicity: "ANECHOIC", shape: "WIDER_THAN_TALL", margin: "SMOOTH", foci: ["NONE"] } },
  { name: "محمود سعيد الجمال", sex: "MALE", age: 63, history: "سكري نوع 2", meds: "Metformin", tsh: 2.7, studies: 1,
    nodule: { lobe: "LEFT", zone: "UPPER", dims: [13, 10, 11], composition: "SOLID", echogenicity: "HYPOECHOIC", shape: "TALLER_THAN_WIDE", margin: "EXTRATHYROIDAL", foci: ["PUNCTATE", "RIM"] } },
  { name: "ريم خالد عثمان", sex: "FEMALE", age: 38, tsh: 1.5, studies: 1,
    nodule: { lobe: "RIGHT", zone: "MIDDLE", dims: [26, 19, 17], composition: "MIXED", echogenicity: "HYPERECHOIC", shape: "WIDER_THAN_TALL", margin: "SMOOTH", foci: ["MACRO"] } },
  { name: "ياسر حسن البنا", sex: "MALE", age: 55, tsh: 3.9, studies: 1, pendingReview: true,
    nodule: { lobe: "LEFT", zone: "LOWER", dims: [8, 6, 6], composition: "SOLID", echogenicity: "ISOECHOIC", shape: "WIDER_THAN_TALL", margin: "SMOOTH", foci: ["NONE"] } },
  { name: "دينا أشرف", sex: "FEMALE", age: 47, family: "أخت مصابة بتضخم درقي", tsh: 2.0, studies: 1,
    nodule: { lobe: "RIGHT", zone: "UPPER", dims: [12, 10, 8], composition: "SOLID", echogenicity: "HYPOECHOIC", shape: "WIDER_THAN_TALL", margin: "LOBULATED", foci: ["NONE"] } },
];

const FOV_W_MM = 64;
const FOV_H_MM = 48;
const manifest: { key: string; view: string; seed: number; nodule: Record<string, unknown> }[] = [];

/** Renders the synthetic ultrasound images via the AI service's generator (Python). */
function renderDemoImages() {
  const storageDir = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? "../storage");
  const aiDir = path.resolve(process.cwd(), "../ai-service");
  const py = process.env.AI_PYTHON ?? path.join(aiDir, process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
  fs.mkdirSync(storageDir, { recursive: true });
  const manifestPath = path.join(storageDir, "demo-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  try {
    const out = execFileSync(py, [path.join(aiDir, "scripts/make_demo_images.py"), manifestPath, storageDir], { encoding: "utf8" });
    console.log(out.trim());
  } catch (e) {
    console.warn("⚠ Could not render demo images (is ai-service/.venv set up?). Data seeded without image files.", (e as Error).message);
    return false;
  }
  return true;
}

/** With STORAGE_DRIVER=db, copy the rendered demo images into Postgres. */
async function uploadDemoImagesToDb() {
  const storageDir = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? "../storage");
  await db.storedFile.deleteMany({ where: { key: { startsWith: "demo/" } } });
  await db.storedFile.deleteMany({ where: { key: { startsWith: "reports/" } } });
  for (const m of manifest) {
    const file = path.join(storageDir, m.key);
    if (fs.existsSync(file)) await db.storedFile.create({ data: { key: m.key, data: fs.readFileSync(file), mimeType: "image/png" } });
  }
  console.log(`stored ${manifest.length} demo images in the database`);
}

const REC_FROM_ACTION: Record<string, Recommendation> = { FNA: "FNA", US_FOLLOW_UP: "US_FOLLOW_UP", NO_ACTION: "ROUTINE_FOLLOW_UP" };

async function main() {
  console.log("Resetting demo data...");
  // Delete in dependency order
  await db.$transaction([
    db.auditLog.deleteMany(), db.message.deleteMany(), db.notification.deleteMany(),
    db.report.deleteMany(), db.doctorReview.deleteMany(), db.noduleFinding.deleteMany(),
    db.aIAnalysisResult.deleteMany(), db.ultrasoundImage.deleteMany(), db.ultrasoundStudy.deleteMany(),
    db.nodule.deleteMany(), db.labResult.deleteMany(), db.followUp.deleteMany(), db.medicalRecord.deleteMany(),
    db.patientAssignment.deleteMany(), db.patient.deleteMany(), db.doctorProfile.deleteMany(), db.user.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const mkUser = (email: string, name: string, role: "ADMIN" | "DOCTOR" | "RADIOLOGIST" | "LAB_TECH" | "PATIENT") =>
    db.user.create({ data: { email, name, role, passwordHash } });

  await mkUser("admin@thyrotrack.demo", "مدير النظام", "ADMIN");
  const labTech = await mkUser("lab@thyrotrack.demo", "فني المعمل حسام", "LAB_TECH");

  const doctors = await Promise.all(
    [
      { email: "dr.sara@thyrotrack.demo", name: "د. سارة الحسيني", role: "DOCTOR" as const, specialty: "Endocrinology", title: "استشاري الغدد الصماء" },
      { email: "dr.omar@thyrotrack.demo", name: "د. عمر نبيل", role: "RADIOLOGIST" as const, specialty: "Radiology", title: "استشاري الأشعة التشخيصية" },
      { email: "dr.khaled@thyrotrack.demo", name: "د. خالد مراد", role: "DOCTOR" as const, specialty: "Endocrine Surgery", title: "استشاري جراحة الغدد" },
    ].map(async (d) => {
      const u = await mkUser(d.email, d.name, d.role);
      const profile = await db.doctorProfile.create({
        data: { userId: u.id, specialty: d.specialty, title: d.title, licenseNumber: `EG-${Math.floor(10000 + rand() * 89999)}` },
      });
      return { user: u, profile };
    }),
  );
  const [sara, omar, khaled] = doctors;

  let studyCounter = 1;

  for (const [i, p] of patients.entries()) {
    const idx = i + 1;
    const pUser = await mkUser(`patient${idx}@thyrotrack.demo`, p.name, "PATIENT");
    const primary = idx <= 6 ? sara : khaled;

    const patient = await db.patient.create({
      data: {
        userId: pUser.id,
        mrn: `MRN-${String(100200 + idx)}`,
        fullName: p.name,
        sex: p.sex,
        dateOfBirth: new Date(new Date().getFullYear() - p.age, (idx * 3) % 12, 5 + idx),
        phoneEnc: encrypt(`+20 10${String(10000000 + idx * 7919).slice(0, 8)}`),
        email: pUser.email,
        medicalHistory: p.history,
        familyHistory: p.family,
        medications: p.meds,
        allergies: p.allergies,
        assignments: {
          create: [
            { doctorId: primary.profile.id, isPrimary: true },
            ...(idx <= 4 || idx === 8 ? [{ doctorId: omar.profile.id, reason: "مراجعة إشعاعية" }] : []),
          ],
        },
      },
    });

    // Labs: TSH/FT4 history
    for (const [k, d] of [400, 200, 20].entries()) {
      await db.labResult.create({
        data: { patientId: patient.id, enteredById: labTech.id, type: "TSH", value: +(p.tsh * (0.85 + k * 0.08)).toFixed(2), unit: "mIU/L", refLow: 0.4, refHigh: 4.0, takenAt: daysAgo(d) },
      });
    }
    await db.labResult.create({
      data: { patientId: patient.id, enteredById: labTech.id, type: "FT4", value: +(1.0 + rand() * 0.6).toFixed(2), unit: "ng/dL", refLow: 0.8, refHigh: 1.8, takenAt: daysAgo(20) },
    });
    await db.labResult.create({
      data: { patientId: patient.id, enteredById: labTech.id, type: "FT3", value: +(2.6 + rand() * 1.2).toFixed(2), unit: "pg/mL", refLow: 2.3, refHigh: 4.2, takenAt: daysAgo(20) },
    });

    const nodule = await db.nodule.create({
      data: { patientId: patient.id, label: "N1", lobe: p.nodule.lobe, zone: p.nodule.zone },
    });

    const studyDates = p.studies === 2 ? [190 + idx * 3, 12 + idx] : [8 + idx];

    for (const [sIdx, ago] of studyDates.entries()) {
      const isLatest = sIdx === studyDates.length - 1;
      const g = sIdx === 1 ? (p.nodule.growth ?? 1) : 1;
      const [l, w, d] = p.nodule.dims.map((x) => jitter(x * g, 0.03));
      const volumeMl = ellipsoidVolumeMl(l, w, d);
      const tir = scoreTirads({
        composition: p.nodule.composition,
        echogenicity: p.nodule.echogenicity,
        shape: p.nodule.shape,
        margin: p.nodule.margin,
        echogenicFoci: p.nodule.foci,
      });
      const risk = riskFromLevel(tir.level);
      const malignancyProb = +[0.02, 0.02, 0.05, 0.12, 0.35, 0.72][tir.level].toFixed(2);
      const confidence = +(0.72 + rand() * 0.22).toFixed(2);
      const pending = isLatest && p.pendingReview;

      // Synthetic image geometry: 800x600 px at 0.08 mm/px → 64 x 48 mm field of view.
      // Transverse: patient's RIGHT lobe on image LEFT. Sagittal: cranial on image left.
      const cx = { RIGHT: 0.3, LEFT: 0.7, ISTHMUS: 0.5 }[p.nodule.lobe];
      const cy = p.nodule.lobe === "ISTHMUS" ? 0.36 : 0.5;
      const rx = w / FOV_W_MM / 2, ry = d / FOV_H_MM / 2;
      const sagCx = { UPPER: 0.3, MIDDLE: 0.5, LOWER: 0.7 }[p.nodule.zone];
      const accession = `US-2026-${String(studyCounter++).padStart(4, "0")}`;
      const look = {
        echo: p.nodule.composition === "CYSTIC" ? "ANECHOIC" : p.nodule.echogenicity === "ANECHOIC" ? "HYPOECHOIC" : p.nodule.echogenicity,
        lobulated: p.nodule.margin === "LOBULATED" || p.nodule.margin === "EXTRATHYROIDAL",
        foci: p.nodule.foci.filter((f) => f === "PUNCTATE" || f === "MACRO"),
      };
      const transKey = `demo/${accession}-trans.png`;
      const sagKey = `demo/${accession}-sag.png`;
      manifest.push(
        { key: transKey, view: "TRANSVERSE", seed: studyCounter * 2, nodule: { cx, cy, rx, ry, ...look } },
        { key: sagKey, view: "SAGITTAL", seed: studyCounter * 2 + 1, nodule: { cx: sagCx, cy: 0.5, rx: l / FOV_W_MM / 2, ry, ...look } },
      );

      const study = await db.ultrasoundStudy.create({
        data: {
          patientId: patient.id,
          orderedById: primary.profile.id,
          accession,
          studyDate: daysAgo(ago),
          device: ["GE LOGIQ E10", "Philips EPIQ 7", "Siemens ACUSON S2000"][idx % 3],
          indication: sIdx === 0 ? "تقييم عقيدة درقية مكتشفة إكلينيكيًا" : "متابعة دورية للعقيدة",
          status: pending ? "ANALYZED" : "REPORTED",
          images: {
            create: [
              { storageKey: transKey, mimeType: "image/png", width: 800, height: 600, pixelSpacingMm: 0.08, view: "TRANSVERSE" },
              { storageKey: sagKey, mimeType: "image/png", width: 800, height: 600, pixelSpacingMm: 0.08, view: "SAGITTAL" },
            ],
          },
        },
        include: { images: true },
      });

      const warnings = p.history?.includes("هاشيموتو")
        ? ["خلفية نسيجية غير متجانسة (Hashimoto) قد تقلل دقة تقدير الصدى"]
        : confidence < 0.78 ? ["جودة الصورة متوسطة — يُنصح بمراجعة حدود العقدة يدويًا"] : [];

      const explanation = tir.breakdown.map((b) => ({
        feature: b.feature,
        value: b.value,
        valueAr: FEATURE_AR[b.value],
        points: b.points,
      }));

      const findingData = {
        noduleId: nodule.id,
        imageId: study.images[0].id,
        lobe: p.nodule.lobe,
        zone: p.nodule.zone,
        nearCapsule: p.nodule.margin === "EXTRATHYROIDAL" || p.nodule.zone === "UPPER",
        bbox: { x: +(cx - rx).toFixed(4), y: +(cy - ry).toFixed(4), w: +(rx * 2).toFixed(4), h: +(ry * 2).toFixed(4) },
        contour: contour(cx, cy, rx, ry),
        lengthMm: l, widthMm: w, depthMm: d, volumeMl,
        composition: p.nodule.composition,
        echogenicity: p.nodule.echogenicity,
        shape: p.nodule.shape,
        margin: p.nodule.margin,
        echogenicFoci: p.nodule.foci,
        tiradsPoints: tir.points,
        tiradsLevel: tir.level,
        risk, malignancyProb, confidence,
        explanation,
      };

      const analysis = await db.aIAnalysisResult.create({
        data: {
          studyId: study.id,
          modelVersion: "demo-seed (synthetic findings) + tirads-rules@ACR2017",
          imageQuality: +(0.7 + rand() * 0.28).toFixed(2),
          warnings,
          durationMs: Math.floor(1800 + rand() * 4000),
          rawOutput: { nodules: [findingData] } as unknown as Prisma.InputJsonValue,
          findings: { create: [findingData] },
        },
      });

      if (pending) {
        await db.notification.create({
          data: { userId: primary.user.id, type: "ANALYSIS_DONE", title: "تحليل جاهز للمراجعة", body: `فحص ${study.accession} بانتظار مراجعتك`, link: `/doctor/studies/${study.id}` },
        });
        continue;
      }

      // Doctor review — some confirmed, some modified
      const modified = idx === 5 && isLatest;
      const action = suggestAction(tir.level, Math.max(l, w, d));
      const recommendation = REC_FROM_ACTION[action];
      const signedAt = daysAgo(ago - 1);
      const content = JSON.stringify({ analysisId: analysis.id, tir: tir.level, recommendation, signedAt });

      const review = await db.doctorReview.create({
        data: {
          analysisId: analysis.id,
          reviewerId: primary.user.id,
          decision: modified ? "MODIFIED" : "CONFIRMED",
          finalTirads: modified ? tir.level + 1 : tir.level,
          finalRisk: modified ? riskFromLevel(tir.level + 1) : risk,
          recommendation: modified ? "FNA" : recommendation,
          clinicalNotes: tir.level >= 4 ? "عقيدة صلبة بصفات مشبوهة؛ تمت مناقشة الخيارات مع المريض." : "صفات مطمئنة، يكفي المتابعة.",
          changeReason: modified ? "تكلسات كبيرة مع حواف غير منتظمة جزئيًا في المقطع الطولي — رفع التصنيف" : null,
          modifiedFindings: modified ? { margin: "LOBULATED", tiradsLevel: tir.level + 1 } : undefined,
          signedAt,
          signatureHash: sha256(content),
        },
      });

      await db.report.create({
        data: {
          patientId: patient.id,
          studyId: study.id,
          reviewId: review.id,
          // A couple of latest reports stay "approved, not sent" so the send flow can be demoed
          status: isLatest && (idx === 1 || idx === 5) ? "APPROVED" : "SENT",
          sentAt: isLatest && (idx === 1 || idx === 5) ? null : signedAt,
        },
      });
    }

    // Growth alert for patient 1 (significant growth between studies)
    if (idx === 1) {
      await db.notification.create({
        data: { userId: sara.user.id, type: "GROWTH_ALERT", title: "زيادة ملحوظة في حجم العقدة", body: "العقدة N1 زادت أكثر من 20% في بعدين", link: `/doctor/patients/${patient.id}` },
      });
    }
    if (["SUSPICIOUS", "HIGH"].includes(riskFromLevel(scoreTirads({ ...p.nodule, echogenicFoci: p.nodule.foci }).level))) {
      await db.notification.create({
        data: { userId: primary.user.id, type: "HIGH_RISK", title: "حالة عالية الخطورة", body: `TI-RADS مرتفع للمريض ${patient.mrn}`, link: `/doctor/patients/${patient.id}` },
      });
    }

    // Follow-ups
    await db.followUp.create({
      data: { patientId: patient.id, doctorId: primary.profile.id, scheduledAt: daysAhead(3 + idx * 4), reason: idx % 3 === 0 ? "مراجعة نتائج FNA" : "سونار متابعة للعقيدة" },
    });
    if (idx % 2 === 0) {
      await db.followUp.create({
        data: { patientId: patient.id, doctorId: primary.profile.id, scheduledAt: daysAgo(30 + idx), reason: "متابعة تحاليل الغدة", status: "COMPLETED" },
      });
    }

    // Patient <-> doctor message
    await db.message.create({
      data: { senderId: pUser.id, recipientId: primary.user.id, body: "دكتور، هل أحتاج لعمل تحليل قبل الموعد القادم؟", createdAt: daysAgo(2) },
    });
  }

  // FNA cytology result for the suspicious case (Bethesda V)
  const p7 = await db.patient.findUniqueOrThrow({ where: { mrn: "MRN-100207" } });
  await db.labResult.create({
    data: { patientId: p7.id, enteredById: labTech.id, type: "FNA_CYTOLOGY", bethesda: 5, notes: "Suspicious for malignancy (Bethesda V)", takenAt: daysAgo(3) },
  });

  if (renderDemoImages() && process.env.STORAGE_DRIVER === "db") await uploadDemoImagesToDb();

  const counts = {
    users: await db.user.count(),
    patients: await db.patient.count(),
    studies: await db.ultrasoundStudy.count(),
    analyses: await db.aIAnalysisResult.count(),
    reports: await db.report.count(),
  };
  console.log("Seed complete:", counts);
  console.log(`All demo accounts use password: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
