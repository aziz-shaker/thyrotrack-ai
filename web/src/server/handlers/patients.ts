import { ok, fail, requireActor, isResponse } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { createPatient, createPatientSchema } from "@/lib/services/patients";
import { HttpError } from "@/lib/services/studies";

/** POST /api/patients — create a patient assigned to the creating doctor (optionally with a portal account) */
export async function POST(req: Request) {
  const actor = await requireActor(["DOCTOR", "RADIOLOGIST"]);
  if (isResponse(actor)) return actor;
  if (!rateLimit(`patient-create:${actor.id}`, 20, 60_000)) return fail(429, "طلبات كثيرة، انتظر قليلًا");
  const parsed = createPatientSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "بيانات غير صالحة", { field: parsed.error.issues[0]?.path.join(".") });
  try {
    return ok(await createPatient(actor, parsed.data), 201);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    throw e;
  }
}
