import { z } from "zod";
import { ok, fail, requireActor, isResponse, UUID_RE } from "@/lib/api";
import { db } from "@/lib/db";
import { canAccessPatient } from "@/lib/access";
import { audit } from "@/lib/audit";

const schema = z.object({ status: z.enum(["COMPLETED", "MISSED", "CANCELLED"]) });

/** PATCH /api/follow-ups/:id — mark a follow-up completed / missed / cancelled */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = await requireActor(["DOCTOR", "RADIOLOGIST"]);
  if (isResponse(actor)) return actor;
  if (!UUID_RE.test(params.id)) return fail(404, "الموعد غير موجود");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "حالة غير صالحة");
  const fu = await db.followUp.findUnique({ where: { id: params.id } });
  if (!fu || !(await canAccessPatient(actor, fu.patientId))) return fail(404, "الموعد غير موجود");
  const updated = await db.followUp.update({ where: { id: fu.id }, data: { status: parsed.data.status } });
  await audit({ actorId: actor.id, action: "FOLLOW_UP_UPDATE", entityType: "FollowUp", entityId: fu.id, meta: { status: parsed.data.status } });
  return ok(updated);
}
