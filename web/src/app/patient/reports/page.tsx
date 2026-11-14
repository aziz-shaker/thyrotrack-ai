import { redirect } from "next/navigation";
import { FileDown } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { RISK_META } from "@/lib/tirads";
import { RECOMMENDATION_AR, LOBE_AR, ZONE_AR } from "@/lib/labels";

export const dynamic = "force-dynamic";

type Pt = [number, number];

export default async function PatientReports() {
  const session = await getSession();
  if (!session) redirect("/login");
  const reports = await db.report.findMany({
    where: { status: "SENT", deletedAt: null, patient: { userId: session.user.id } },
    orderBy: { sentAt: "desc" },
    include: {
      study: { include: { images: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } } },
      review: { include: { reviewer: { select: { name: true } }, analysis: { include: { findings: { take: 1 } } } } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-800">تقاريري</h1>
        <p className="mt-1 text-ink-soft">كل تقرير هنا راجعه طبيبك واعتمده.</p>
      </div>
      {reports.length === 0 && <p className="rounded-2xl border border-navy-100 bg-white p-6 text-ink-soft">لا توجد تقارير بعد.</p>}
      {reports.map((r) => {
        const f = r.review.analysis.findings[0];
        const img = r.study.images.find((i) => i.id === f?.imageId) ?? r.study.images[0];
        const mod = (r.review.modifiedFindings ?? {}) as { contour?: Pt[] };
        const contour = mod.contour ?? (f?.contour as Pt[] | undefined) ?? [];
        const risk = r.review.finalRisk ? RISK_META[r.review.finalRisk] : null;
        return (
          <article key={r.id} className="grid gap-5 rounded-2xl border border-navy-100 bg-white p-5 md:grid-cols-[1fr_1.2fr]">
            {img && (
              <figure className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: img.width && img.height ? `${img.width}/${img.height}` : "4/3" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/images/${img.id}`} alt="صورة السونار مع تحديد مكان العقدة" className="absolute inset-0 h-full w-full" />
                {contour.length > 2 && (
                  <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
                    <polygon points={contour.map((p) => p.join(",")).join(" ")} fill="rgba(45,178,232,0.2)" stroke="#2DB2E8" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  </svg>
                )}
                <figcaption className="absolute bottom-2 start-2 rounded bg-black/60 px-2 py-1 text-xs text-white">المنطقة الملوّنة هي مكان العقدة</figcaption>
              </figure>
            )}
            <div className="flex flex-col">
              <p className="text-sm text-ink-muted">{r.study.studyDate.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })}</p>
              <h2 className="mt-1 text-xl font-bold text-navy-800">تقرير سونار الغدة الدرقية</h2>
              <dl className="mt-4 space-y-2 text-sm">
                {risk && <div className="flex gap-2"><dt className="w-28 text-ink-muted">النتيجة</dt><dd className={`rounded-full px-2.5 py-0.5 font-semibold ${risk.bg} ${risk.color}`}>{risk.ar}</dd></div>}
                {f && <div className="flex gap-2"><dt className="w-28 text-ink-muted">المكان</dt><dd className="text-navy-800">{LOBE_AR[f.lobe]}، {ZONE_AR[f.zone]}</dd></div>}
                <div className="flex gap-2"><dt className="w-28 text-ink-muted">التوصية</dt><dd className="text-navy-800">{RECOMMENDATION_AR[r.review.recommendation]}</dd></div>
                <div className="flex gap-2"><dt className="w-28 text-ink-muted">الطبيب</dt><dd className="text-navy-800">{r.review.reviewer.name}</dd></div>
              </dl>
              {r.review.clinicalNotes && <p className="mt-3 rounded-lg bg-navy-50 p-3 text-sm text-navy-800">{r.review.clinicalNotes}</p>}
              <a href={`/api/reports/${r.id}/pdf`} target="_blank" rel="noopener" className="btn-primary mt-auto self-start">
                <FileDown className="h-4 w-4" /> تحميل التقرير PDF
              </a>
            </div>
          </article>
        );
      })}
    </div>
  );
}
