import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Clock, FileText, Info, MessageCircle } from "lucide-react";
import type { RiskCategory, Recommendation } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { thyroidModel } from "@/lib/services/model3d";
import { RECOMMENDATION_AR, LOBE_AR, ZONE_AR } from "@/lib/labels";
import { ThyroidModelLazy } from "@/components/three/ThyroidModelLazy";

export const dynamic = "force-dynamic";

/** Plain-language summaries — no unexplained jargon, never a diagnosis. */
const PLAIN: Record<RiskCategory, { title: string; text: string; tone: string }> = {
  BENIGN: { title: "النتيجة مطمئنة", text: "العقدة لها صفات العقد الحميدة غالبًا. يكفي عادةً المتابعة حسب توجيه طبيبك.", tone: "bg-green-50 text-green-900 border-green-200" },
  LOW: { title: "النتيجة مطمئنة", text: "العقدة لها صفات منخفضة الخطورة. يكفي عادةً المتابعة حسب توجيه طبيبك.", tone: "bg-green-50 text-green-900 border-green-200" },
  MODERATE: { title: "تحتاج متابعة", text: "العقدة لها بعض الصفات التي تستدعي متابعتها بالسونار على فترات، وقد يطلب الطبيب فحصًا إضافيًا حسب حجمها.", tone: "bg-yellow-50 text-yellow-900 border-yellow-200" },
  HIGH: { title: "تحتاج فحصًا إضافيًا", text: "العقدة لها صفات تحتاج تأكيدًا. غالبًا يطلب الطبيب سحب عينة صغيرة بإبرة رفيعة (FNA). هذا لا يعني بالضرورة وجود ورم خبيث.", tone: "bg-orange-50 text-orange-900 border-orange-200" },
  SUSPICIOUS: { title: "تحتاج فحصًا إضافيًا قريبًا", text: "العقدة لها صفات تستدعي فحصًا سريعًا، غالبًا سحب عينة صغيرة بإبرة رفيعة (FNA). كثير من هذه العقد يتضح أنها حميدة، والعينة هي ما يحسم ذلك.", tone: "bg-red-50 text-red-900 border-red-200" },
};

const NEXT_STEP: Partial<Record<Recommendation, string>> = {
  FNA: "سحب عينة صغيرة بإبرة رفيعة (FNA): إجراء بسيط في العيادة لفحص خلايا العقدة تحت الميكروسكوب.",
  US_FOLLOW_UP: "سونار متابعة بعد فترة يحددها الطبيب، للتأكد من أن العقدة لا تكبر.",
  ROUTINE_FOLLOW_UP: "مراجعة دورية مع طبيبك.",
  LAB_TESTS: "تحاليل دم لوظائف الغدة.",
  ADDITIONAL_IMAGING: "إشاعة إضافية لرؤية العقدة بشكل أوضح.",
  SURGICAL_REFERRAL: "استشارة جرّاح غدد لمناقشة الخيارات.",
};

export default async function PatientHome() {
  const session = await getSession();
  if (!session) redirect("/login");
  const patient = await db.patient.findUnique({
    where: { userId: session.user.id },
    include: {
      assignments: { where: { isPrimary: true }, include: { doctor: { include: { user: { select: { name: true } } } } } },
      followUps: { where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } }, orderBy: { scheduledAt: "asc" }, take: 3 },
      labResults: { where: { type: "TSH", deletedAt: null }, orderBy: { takenAt: "desc" }, take: 1 },
      reports: {
        where: { status: "SENT", deletedAt: null },
        orderBy: { sentAt: "desc" },
        take: 1,
        include: { study: true, review: { include: { reviewer: { select: { name: true } }, analysis: { include: { findings: { take: 1 } } } } } },
      },
      studies: { where: { deletedAt: null, status: { in: ["UPLOADED", "ANALYZING", "ANALYZED", "REVIEWED"] } }, select: { id: true } },
    },
  });
  if (!patient) redirect("/login");
  await audit({ actorId: session.user.id, action: "PORTAL_VIEW", entityType: "Patient", entityId: patient.id });

  const [nodules, notifications] = await Promise.all([
    thyroidModel(patient.id, "patient"),
    db.notification.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 4 }),
  ]);
  const latest = patient.reports[0];
  const review = latest?.review;
  const f = review?.analysis.findings[0];
  const plain = review?.finalRisk ? PLAIN[review.finalRisk] : null;
  const doctor = patient.assignments[0]?.doctor;
  const tsh = patient.labResults[0];
  const pendingStudies = patient.studies.length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-800">أهلًا، {patient.fullName.split(" ")[0]}</h1>

      {pendingStudies > 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-navy-100 bg-white px-4 py-3 text-sm text-navy-800">
          <Clock className="h-4 w-4 text-brand-500" /> لديك إشاعة جديدة يراجعها طبيبك الآن، وستظهر النتيجة هنا بعد اعتمادها.
        </p>
      )}

      {/* Current status in plain words */}
      {review && plain ? (
        <section className={`rounded-2xl border p-6 ${plain.tone}`} aria-labelledby="status-title">
          <p className="text-sm opacity-80">نتيجة آخر سونار، {latest.study.studyDate.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })}</p>
          <h2 id="status-title" className="mt-1 text-2xl font-bold">{plain.title}</h2>
          <p className="mt-2 max-w-2xl leading-7">{plain.text}</p>
          {f && <p className="mt-3 text-sm">مكان العقدة: <b>{LOBE_AR[f.lobe]}، {ZONE_AR[f.zone]}</b></p>}
          <div className="mt-4 rounded-xl bg-white/70 p-4 text-navy-800">
            <p className="text-sm font-semibold">الخطوة التالية التي يوصي بها طبيبك</p>
            <p className="mt-1">{NEXT_STEP[review.recommendation] ?? RECOMMENDATION_AR[review.recommendation]}</p>
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs opacity-80">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> راجع هذه النتيجة واعتمدها {review.reviewer.name}. استخدم النظام أدوات الذكاء الاصطناعي للمساعدة فقط، والقرار النهائي للطبيب.
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-navy-100 bg-white p-6">
          <h2 className="text-xl font-bold text-navy-800">لا توجد نتائج معتمدة بعد</h2>
          <p className="mt-1 text-ink-soft">ستظهر نتيجتك هنا بعد أن يراجعها طبيبك ويعتمدها.</p>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="model-title">
          <h2 id="model-title" className="mb-3 text-lg font-bold text-navy-800">مكان العقدة في الغدة</h2>
          {nodules.length ? <ThyroidModelLazy nodules={nodules} mode="patient" /> : <p className="rounded-2xl border border-navy-100 bg-white p-6 text-sm text-ink-soft">سيظهر النموذج بعد اعتماد أول تقرير.</p>}
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-navy-100 bg-white p-5">
            <h2 className="flex items-center gap-2 font-bold text-navy-800"><CalendarClock className="h-5 w-5 text-brand-500" /> مواعيدك القادمة</h2>
            {patient.followUps.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">لا توجد مواعيد محددة.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {patient.followUps.map((fu) => (
                  <li key={fu.id} className="rounded-lg bg-navy-50 px-3 py-2.5 text-sm">
                    <p className="font-semibold text-navy-800">{fu.scheduledAt.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })}</p>
                    <p className="text-ink-soft">{fu.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {tsh && (
            <section className="rounded-2xl border border-navy-100 bg-white p-5">
              <h2 className="font-bold text-navy-800">تحليل TSH</h2>
              <p className="mt-1 text-xs text-ink-muted">هرمون يوضح مدى نشاط الغدة الدرقية</p>
              <p className="mt-3 text-3xl font-bold text-navy-800" dir="ltr">{tsh.value} <span className="text-sm font-normal text-ink-soft">{tsh.unit}</span></p>
              <p className={`mt-1 text-sm font-semibold ${tsh.value != null && tsh.refHigh != null && tsh.value > tsh.refHigh ? "text-orange-700" : "text-green-700"}`}>
                {tsh.value != null && tsh.refHigh != null && tsh.value > tsh.refHigh ? "أعلى من المعدل الطبيعي، ناقشه مع طبيبك" : tsh.value != null && tsh.refLow != null && tsh.value < tsh.refLow ? "أقل من المعدل الطبيعي، ناقشه مع طبيبك" : "في المعدل الطبيعي"}
              </p>
              <p className="mt-1 text-xs text-ink-muted">المعدل الطبيعي <span dir="ltr">{tsh.refLow}–{tsh.refHigh}</span>، بتاريخ {tsh.takenAt.toLocaleDateString("ar-EG")}</p>
            </section>
          )}

          <section className="rounded-2xl border border-navy-100 bg-white p-5">
            <h2 className="font-bold text-navy-800">تنبيهات من طبيبك</h2>
            {notifications.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">لا توجد تنبيهات.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {notifications.map((n) => (
                  <li key={n.id}><Link href={n.link ?? "#"} className="block rounded-lg px-2 py-1.5 hover:bg-navy-50"><b className="text-navy-800">{n.title}</b><span className="block text-ink-soft">{n.body}</span></Link></li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/patient/reports" className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-white p-5 hover:border-brand-400">
          <FileText className="h-6 w-6 text-brand-500" /> <span><b className="block text-navy-800">تقاريري وصور الإشاعات</b><span className="text-sm text-ink-soft">حمّل تقاريرك بصيغة PDF</span></span>
        </Link>
        <Link href="/patient/messages" className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-white p-5 hover:border-brand-400">
          <MessageCircle className="h-6 w-6 text-brand-500" /> <span><b className="block text-navy-800">اسأل طبيبك</b><span className="text-sm text-ink-soft">{doctor ? doctor.user.name : "طبيبك المعالج"}</span></span>
        </Link>
      </div>
    </div>
  );
}
