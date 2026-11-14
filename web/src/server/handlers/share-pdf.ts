import { fail } from "@/lib/api";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { getReportByToken, reportResponse } from "@/lib/services/reports";


/** GET /api/share/:token/pdf — public, expiring, unguessable link (256-bit token) */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`share:${ip}`, 20, 60_000)) return fail(429, "طلبات كثيرة");
  const r = await getReportByToken(params.token);
  if (!r) return fail(404, "الرابط غير صالح أو انتهت صلاحيته");
  await audit({ action: "REPORT_SHARE_DOWNLOAD", entityType: "Report", entityId: r.id, ip });
  const res = await reportResponse(r, "ThyroTrack-report.pdf");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}
