import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { patientScope } from "@/lib/access";
import { RECOMMENDATION_AR } from "@/lib/labels";
import { Card, EmptyState } from "@/components/ui/Card";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { ReportActions } from "@/components/study/ReportActions";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const scope = await patientScope({ id: session.user.id, role: session.user.role });
  const reports = await db.report.findMany({
    where: { deletedAt: null, patient: scope },
    include: {
      patient: { select: { fullName: true, mrn: true } },
      study: { select: { id: true, accession: true, studyDate: true } },
      review: { select: { finalTirads: true, finalRisk: true, recommendation: true, signedAt: true, reviewer: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unsent = reports.filter((r) => r.status !== "SENT").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-800">التقارير</h1>
        <p className="mt-1 text-ink-soft">{unsent ? `${unsent} تقرير معتمد لم يُرسل للمريض بعد` : "كل التقارير المعتمدة أُرسلت للمرضى"}</p>
      </div>
      <Card className="overflow-x-auto p-0">
        {reports.length === 0 ? (
          <div className="p-6"><EmptyState text="لا توجد تقارير بعد. التقرير يُنشأ تلقائيًا بعد اعتماد مراجعة الإشاعة." /></div>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-navy-50 text-ink-soft">
              <tr>{["المريض", "الفحص", "التصنيف", "التوصية", "اعتمده", ""].map((h) => <th key={h} className="px-5 py-3 text-start font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-navy-800">{r.patient.fullName}</p>
                    <p className="text-xs text-ink-muted" dir="ltr">{r.patient.mrn}</p>
                  </td>
                  <td className="px-5 py-4">
                    <Link href={`/doctor/studies/${r.study.id}`} className="text-brand-700 hover:underline" dir="ltr">{r.study.accession}</Link>
                    <p className="text-xs text-ink-muted">{r.study.studyDate.toLocaleDateString("ar-EG")}</p>
                  </td>
                  <td className="px-5 py-4">{r.review.finalRisk ? <RiskBadge risk={r.review.finalRisk} tirads={r.review.finalTirads} /> : <span className="text-ink-muted">مرفوض</span>}</td>
                  <td className="px-5 py-4 text-ink-soft">{RECOMMENDATION_AR[r.review.recommendation]}</td>
                  <td className="px-5 py-4 text-ink-soft">
                    {r.review.reviewer.name}
                    <p className="text-xs text-ink-muted">{r.review.signedAt?.toLocaleDateString("ar-EG")}</p>
                  </td>
                  <td className="px-5 py-4">
                    <ReportActions reportId={r.id} status={r.status} shareToken={null} shareExpiresAt={null} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
