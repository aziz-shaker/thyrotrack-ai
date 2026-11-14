import { ok, fail, requireActor, isResponse, UUID_RE } from "@/lib/api";
import { sendReport } from "@/lib/services/reports";
import { HttpError } from "@/lib/services/studies";

/** POST /api/reports/:id/send — publish a signed report to the patient (portal + expiring link) */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const actor = await requireActor(["DOCTOR", "RADIOLOGIST"]);
  if (isResponse(actor)) return actor;
  if (!UUID_RE.test(params.id)) return fail(404, "التقرير غير موجود");
  try {
    return ok(await sendReport(actor, params.id));
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    throw e;
  }
}
