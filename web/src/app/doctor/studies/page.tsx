import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { patientScope } from "@/lib/access";
import { STUDY_STATUS_AR } from "@/lib/labels";
import { Card, EmptyState } from "@/components/ui/Card";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { Tabs } from "@/components/ui/Tabs";

export const dynamic = "force-dynamic";

const FILTERS: Record<string, { label: string; where: Prisma.UltrasoundStudyWhereInput }> = {
  pending: { label: "بانتظار المراجعة", where: { status: { in: ["UPLOADED", "ANALYZED"] } } },
  done: { label: "معتمدة", where: { status: { in: ["REVIEWED", "REPORTED"] } } },
  all: { label: "الكل", where: {} },
};

export default async function StudiesPage({ searchParams }: { searchParams: { tab?: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const scope = await patientScope({ id: session.user.id, role: session.user.role });
  const tab = searchParams.tab && FILTERS[searchParams.tab] ? searchParams.tab : "pending";

  const [studies, counts] = await Promise.all([
    db.ultrasoundStudy.findMany({
      where: { deletedAt: null, patient: scope, ...FILTERS[tab].where },
      include: {
        patient: { select: { fullName: true, mrn: true } },
        _count: { select: { images: true } },
        analyses: { take: 1, orderBy: { createdAt: "desc" }, include: { findings: { take: 1 }, review: true } },
      },
      orderBy: { studyDate: "desc" },
      take: 100,
    }),
    Promise.all(Object.entries(FILTERS).map(async ([k, f]) => [k, await db.ultrasoundStudy.count({ where: { deletedAt: null, patient: scope, ...f.where } })] as const)),
  ]);
  const countMap = Object.fromEntries(counts);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-navy-800">الإشاعات</h1>
        <Link href="/doctor/studies/new" className="btn-primary">رفع إشاعة جديدة</Link>
      </div>

      <Tabs base="/doctor/studies" active={tab} tabs={Object.entries(FILTERS).map(([id, f]) => ({ id, label: f.label, count: countMap[id] }))} />

      <Card className="overflow-x-auto p-0">
        {studies.length === 0 ? (
          <div className="p-6">
            <EmptyState text={tab === "pending" ? "لا توجد إشاعات بانتظار المراجعة." : "لا توجد إشاعات بعد. ارفع أول إشاعة من الزر بالأعلى."} />
          </div>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-navy-50 text-ink-soft">
              <tr>
                {["المريض", "التاريخ", "الصور", "التصنيف", "الحالة", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-start font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {studies.map((s) => {
                const a = s.analyses[0];
                const f = a?.findings[0];
                const pending = s.status === "UPLOADED" || s.status === "ANALYZED";
                return (
                  <tr key={s.id} className="hover:bg-navy-50/50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-navy-800">{s.patient.fullName}</p>
                      <p className="text-xs text-ink-muted" dir="ltr">{s.accession}</p>
                    </td>
                    <td className="px-5 py-4 text-ink-soft">{s.studyDate.toLocaleDateString("ar-EG")}</td>
                    <td className="px-5 py-4 text-ink-soft">{s._count.images}</td>
                    <td className="px-5 py-4">{f ? <RiskBadge risk={a.review?.finalRisk ?? f.risk} tirads={a.review?.finalTirads ?? f.tiradsLevel} /> : <span className="text-ink-muted">لم يُحلَّل</span>}</td>
                    <td className="px-5 py-4">
                      <span className={pending ? "font-semibold text-coral-600" : "text-ink-soft"}>{STUDY_STATUS_AR[s.status]}</span>
                    </td>
                    <td className="px-5 py-4 text-end">
                      <Link href={`/doctor/studies/${s.id}`} className="font-semibold text-brand-600 hover:underline">
                        {s.status === "UPLOADED" ? "تحليل" : s.status === "ANALYZED" ? "مراجعة" : "عرض"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
