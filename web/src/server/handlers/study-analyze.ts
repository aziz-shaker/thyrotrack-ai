import { ok, fail, requireActor, isResponse, UUID_RE } from "@/lib/api";
import { runAnalysis, HttpError } from "@/lib/services/studies";
import { rateLimit } from "@/lib/rate-limit";

/** POST /api/studies/:id/analyze — run the AI pipeline on all images of the study */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const actor = await requireActor(["DOCTOR", "RADIOLOGIST"]);
  if (isResponse(actor)) return actor;
  if (!UUID_RE.test(params.id)) return fail(404, "الفحص غير موجود");
  if (!rateLimit(`analyze:${actor.id}`, 10, 60_000)) return fail(429, "عدد كبير من طلبات التحليل، حاول بعد دقيقة");
  try {
    return ok(await runAnalysis(actor, params.id), 201);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    throw e;
  }
}

