import { ok, fail, requireActor, isResponse, UUID_RE } from "@/lib/api";
import { createStudy, createStudySchema, HttpError } from "@/lib/services/studies";

/** POST /api/patients/:id/studies — create an ultrasound study */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = await requireActor(["DOCTOR", "RADIOLOGIST"]);
  if (isResponse(actor)) return actor;
  if (!UUID_RE.test(params.id)) return fail(404, "المريض غير موجود");
  const parsed = createStudySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
  try {
    return ok(await createStudy(actor, params.id, parsed.data), 201);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    throw e;
  }
}
