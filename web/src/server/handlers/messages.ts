import { z } from "zod";
import { ok, fail, requireActor, isResponse } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { send, thread, primaryDoctorUserId } from "@/lib/services/messages";
import { HttpError } from "@/lib/services/studies";

const schema = z.object({
  recipientId: z.string().uuid().optional(), // patients may omit → their primary doctor
  body: z.string().trim().min(1, "اكتب رسالتك").max(2000, "الرسالة طويلة جدًا"),
});

/** GET /api/messages?with=<userId> — conversation thread */
export async function GET(req: Request) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;
  const other = new URL(req.url).searchParams.get("with") ?? (actor.role === "PATIENT" ? (await primaryDoctorUserId(actor.id))?.id : null);
  if (!other) return fail(400, "حدد المحادثة");
  try {
    return ok({ messages: await thread(actor, other) });
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    throw e;
  }
}

/** POST /api/messages — send a message (patient ↔ assigned doctor only) */
export async function POST(req: Request) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;
  if (!rateLimit(`msg:${actor.id}`, 20, 60_000)) return fail(429, "رسائل كثيرة، انتظر قليلًا");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
  const recipient = parsed.data.recipientId ?? (actor.role === "PATIENT" ? (await primaryDoctorUserId(actor.id))?.id : undefined);
  if (!recipient) return fail(400, "حدد المستلم");
  try {
    return ok(await send(actor, recipient, parsed.data.body), 201);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    throw e;
  }
}
