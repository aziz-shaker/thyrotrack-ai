import { z } from "zod";
import { ok, fail, requireActor, isResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { canAccessPatient } from "@/lib/access";
import { audit } from "@/lib/audit";

const schema = z.object({
  patientId: z.string().uuid(),
  scheduledAt: z.coerce.date().min(new Date(Date.now() - 60_000), "الموعد يجب أن يكون في المستقبل"),
  reason: z.string().trim().min(3, "اكتب سبب الموعد").max(200),
  notes: z.string().trim().max(1000).optional(),
});

/** POST /api/follow-ups — schedule a follow-up and notify the patient */
export async function POST(req: Request) {
  const actor = await requireActor(["DOCTOR", "RADIOLOGIST"]);
  if (isResponse(actor)) return actor;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
  const { patientId, scheduledAt, reason, notes } = parsed.data;
  if (!(await canAccessPatient(actor, patientId))) return fail(404, "المريض غير موجود");

  const doctor = await db.doctorProfile.findUnique({ where: { userId: actor.id } });
  const fu = await db.followUp.create({ data: { patientId, doctorId: doctor?.id, scheduledAt, reason, notes } });
  const patient = await db.patient.findUnique({ where: { id: patientId }, select: { userId: true } });
  if (patient?.userId) {
    await db.notification.create({
      data: { userId: patient.userId, type: "FOLLOW_UP", title: "موعد متابعة جديد", body: `${reason}، ${scheduledAt.toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}`, link: "/patient" },
    });
  }
  await audit({ actorId: actor.id, action: "FOLLOW_UP_CREATE", entityType: "FollowUp", entityId: fu.id });
  return ok(fu, 201);
}
