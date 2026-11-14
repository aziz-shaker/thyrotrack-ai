import { fail, requireActor, isResponse, UUID_RE } from "@/lib/api";
import { db } from "@/lib/db";
import { canAccessPatient } from "@/lib/access";
import { storage } from "@/lib/storage";

/** GET /api/images/:id — serve an ultrasound image after patient-level access check */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;
  if (!UUID_RE.test(params.id)) return fail(404, "الصورة غير موجودة");
  const img = await db.ultrasoundImage.findFirst({ where: { id: params.id, deletedAt: null }, include: { study: { select: { patientId: true, status: true } } } });
  if (!img || !(await canAccessPatient(actor, img.study.patientId))) return fail(404, "الصورة غير موجودة");
  // Patients only see images once the doctor has signed and sent the report
  if (actor.role === "PATIENT" && img.study.status !== "REPORTED") return fail(404, "الصورة غير موجودة");
  try {
    const data = await storage.get(img.storageKey);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": img.mimeType, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return fail(404, "ملف الصورة غير موجود على الخادم");
  }
}
