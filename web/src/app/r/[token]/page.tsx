import { FileDown, ShieldAlert, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { getReportByToken } from "@/lib/services/reports";
import { RISK_META } from "@/lib/tirads";
import { RECOMMENDATION_AR } from "@/lib/labels";

export const dynamic = "force-dynamic";
export const metadata = { title: "تقرير طبي | ThyroTrack AI", robots: { index: false, follow: false } };

/** Public page behind an expiring 256-bit token. Shows minimal info; full details are in the PDF. */
export default async function SharedReport({ params }: { params: { token: string } }) {
  const r = await getReportByToken(params.token);

  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F6F8] p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-card">
        <Logo />
        {!r ? (
          <div className="mt-8 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-amber-500" />
            <h1 className="mt-3 text-xl font-bold text-navy-800">الرابط غير صالح أو انتهت صلاحيته</h1>
            <p className="mt-2 text-sm text-ink-soft">اطلب من طبيبك إرسال التقرير مرة أخرى، أو ادخل إلى بوابة المريض.</p>
          </div>
        ) : (
          <div className="mt-8">
            <p className="flex items-center gap-2 text-sm font-semibold text-green-700"><ShieldCheck className="h-4 w-4" /> تقرير معتمد من الطبيب</p>
            <h1 className="mt-2 text-xl font-bold text-navy-800">تقرير سونار الغدة الدرقية</h1>
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-muted">المريض</dt><dd className="font-semibold text-navy-800">{r.patient.fullName}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">تاريخ الفحص</dt><dd className="text-navy-800">{r.study.studyDate.toLocaleDateString("ar-EG")}</dd></div>
              {r.review.finalRisk && (
                <div className="flex justify-between"><dt className="text-ink-muted">النتيجة</dt><dd className="text-navy-800">{RISK_META[r.review.finalRisk].ar}</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-ink-muted">التوصية</dt><dd className="text-navy-800">{RECOMMENDATION_AR[r.review.recommendation]}</dd></div>
            </dl>
            <a href={`/api/share/${params.token}/pdf`} className="btn-primary mt-6 w-full py-3"><FileDown className="h-5 w-5" /> تحميل التقرير PDF</a>
            <p className="mt-4 text-xs text-ink-muted">الرابط صالح حتى {r.shareExpiresAt!.toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}. ناقش النتيجة مع طبيبك.</p>
          </div>
        )}
      </div>
    </main>
  );
}
