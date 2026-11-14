import { ok, fail, requireActor, isResponse, UUID_RE, clientIp } from "@/lib/api";
import { submitReview, reviewSchema, HttpError } from "@/lib/services/studies";

/** POST /api/analysis/:id/review — doctor confirms / modifies / rejects the AI result and signs */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = await requireActor(["DOCTOR", "RADIOLOGIST"]);
  if (isResponse(actor)) return actor;
  if (!UUID_RE.test(params.id)) return fail(404, "التحليل غير موجود");
  const parsed = reviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "بيانات غير صالحة", { field: parsed.error.issues[0]?.path.join(".") });
  try {
    const review = await submitReview(actor, params.id, parsed.data, clientIp(req));
    return ok({ id: review.id, signedAt: review.signedAt, signatureHash: review.signatureHash, finalTirads: review.finalTirads }, 201);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    throw e;
  }
}

// PATCH kept as an alias to match the documented REST contract (PATCH /analysis/:id/review)
export const PATCH = POST;
