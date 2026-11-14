import { z } from "zod";
import { ok, fail, requireActor, isResponse, UUID_RE } from "@/lib/api";
import { db } from "@/lib/db";
import { canAccessPatient, can } from "@/lib/access";
import { audit } from "@/lib/audit";

const REF: Record<string, { unit: string; low: number; high: number }> = {
  TSH: { unit: "mIU/L", low: 0.4, high: 4.0 },
  FT4: { unit: "ng/dL", low: 0.8, high: 1.8 },
  FT3: { unit: "pg/mL", low: 2.3, high: 4.2 },
  ANTI_TPO: { unit: "IU/mL", low: 0, high: 34 },
  THYROGLOBULIN: { unit: "ng/mL", low: 1.5, high: 38.5 },
  CALCITONIN: { unit: "pg/mL", low: 0, high: 10 },
};

const schema = z
  .object({
    type: z.enum(["TSH", "FT3", "FT4", "ANTI_TPO", "THYROGLOBULIN", "CALCITONIN", "FNA_CYTOLOGY"]),
    value: z.number().min(0).max(100000).optional(),
    bethesda: z.number().int().min(1).max(6).optional(),
    notes: z.string().trim().max(1000).optional(),
    takenAt: z.coerce.date().max(new Date(Date.now() + 86_400_000), "تاريخ التحليل لا يمكن أن يكون في المستقبل"),
  })
  .refine((d) => (d.type === "FNA_CYTOLOGY" ? d.bethesda != null : d.value != null), { message: "أدخل القيمة (أو تصنيف Bethesda لعينة FNA)" });

/** POST /api/patients/:id/labs — lab technician / clinician enters a lab or cytology result */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;
  if (!can.enterLabs(actor.role)) return fail(403, "ليس لديك صلاحية إدخال التحاليل");
  if (!UUID_RE.test(params.id) || !(await canAccessPatient(actor, params.id))) return fail(404, "المريض غير موجود");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
  const d = parsed.data;
  const ref = REF[d.type];
  const lab = await db.labResult.create({
    data: { patientId: params.id, enteredById: actor.id, type: d.type, value: d.value, unit: ref?.unit, refLow: ref?.low, refHigh: ref?.high, bethesda: d.bethesda, notes: d.notes, takenAt: d.takenAt },
  });
  // Bethesda V/VI → alert the assigned doctors
  if ((d.bethesda ?? 0) >= 5) {
    const docs = await db.patientAssignment.findMany({ where: { patientId: params.id }, select: { doctor: { select: { userId: true } } } });
    await db.notification.createMany({
      data: docs.map((x) => ({ userId: x.doctor.userId, type: "HIGH_RISK" as const, title: `نتيجة FNA: Bethesda ${d.bethesda}`, body: "نتيجة خلوية مشتبه بها تحتاج مراجعة", link: `/doctor/patients/${params.id}` })),
    });
  }
  await audit({ actorId: actor.id, action: "LAB_CREATE", entityType: "LabResult", entityId: lab.id, meta: { type: d.type } });
  return ok(lab, 201);
}
