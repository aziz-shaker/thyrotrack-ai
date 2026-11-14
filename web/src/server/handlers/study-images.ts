import { ok, fail, requireActor, isResponse, UUID_RE } from "@/lib/api";
import { addImages, HttpError } from "@/lib/services/studies";
import { rateLimit } from "@/lib/rate-limit";

/** POST /api/studies/:id/images — multipart: files[] + views[] (+ optional pixelSpacing[]) */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = await requireActor(["DOCTOR", "RADIOLOGIST"]);
  if (isResponse(actor)) return actor;
  if (!UUID_RE.test(params.id)) return fail(404, "الفحص غير موجود");
  if (!rateLimit(`upload:${actor.id}`, 30, 60_000)) return fail(429, "عدد كبير من الطلبات، حاول بعد قليل");

  const form = await req.formData().catch(() => null);
  if (!form) return fail(400, "طلب غير صالح");
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return fail(400, "اختر صورة واحدة على الأقل");
  const views = form.getAll("views").map(String);
  const spacings = form.getAll("pixelSpacing").map((s) => Number(s));

  try {
    const created = await addImages(
      actor,
      params.id,
      await Promise.all(
        files.map(async (f, i) => ({
          data: Buffer.from(await f.arrayBuffer()),
          view: views[i] ?? "UNKNOWN",
          pixelSpacingMm: spacings[i] > 0 && spacings[i] < 2 ? spacings[i] : null,
        })),
      ),
    );
    return ok({ images: created.map((c) => ({ id: c.id, view: c.view })) }, 201);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    throw e;
  }
}

