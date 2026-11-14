import { fail, requireActor, isResponse, UUID_RE } from "@/lib/api";
import { audit } from "@/lib/audit";
import { getReportForActor, reportResponse } from "@/lib/services/reports";
import { HttpError } from "@/lib/services/studies";


/** GET /api/reports/:id/pdf — staff within scope, or the patient once the report was sent */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const actor = await requireActor();
  if (isResponse(actor)) return actor;
  if (!UUID_RE.test(params.id)) return fail(404, "التقرير غير موجود");
  try {
    const r = await getReportForActor(actor, params.id);
    await audit({ actorId: actor.id, action: "REPORT_DOWNLOAD", entityType: "Report", entityId: r.id });
    return reportResponse(r, `ThyroTrack-${r.study.accession}.pdf`);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    throw e;
  }
}
