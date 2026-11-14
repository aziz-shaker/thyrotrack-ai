import { ok, fail, requireActor, isResponse, UUID_RE } from "@/lib/api";
import { canAccessPatient } from "@/lib/access";
import { thyroidModel } from "@/lib/services/model3d";

/** GET /api/patients/:id/3d-model — nodule positions/sizes/risk over time for the 3D thyroid */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;
  if (!UUID_RE.test(params.id) || !(await canAccessPatient(actor, params.id))) return fail(404, "المريض غير موجود");
  return ok({ nodules: await thyroidModel(params.id, actor.role === "PATIENT" ? "patient" : "clinician") });
}
