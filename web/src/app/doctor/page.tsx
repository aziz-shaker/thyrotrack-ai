import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarClock, ClipboardList, Users, ChevronLeft } from "lucide-react";
import type { RiskCategory } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { patientScope } from "@/lib/access";
import { Card, CardTitle, EmptyState } from "@/components/ui/Card";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { StudiesChart, type MonthRow } from "@/components/doctor/StudiesChart";

export const dynamic = "force-dynamic";

export default async function DoctorHome() {
  const session = await getSession();
  if (!session) redirect("/login");
  const actor = { id: session.user.id, role: session.user.role };
  const scope = await patientScope(actor);
  const in30 = new Date(Date.now() + 30 * 86_400_000);

  const [patientCount, studies, pending, followUps] = await Promise.all([
    db.patient.count({ where: scope }),
    db.ultrasoundStudy.findMany({
      where: { deletedAt: null, patient: scope, studyDate: { gte: new Date(Date.now() - 365 * 86_400_000) } },
      select: {
        studyDate: true, patientId: true,
        analyses: { take: 1, orderBy: { createdAt: "desc" }, select: { findings: { select: { risk: true } }, review: { select: { finalRisk: true } } } },
      },
      orderBy: { studyDate: "asc" },
    }),
    db.ultrasoundStudy.findMany({
      where: { status: "ANALYZED", deletedAt: null, patient: scope },
      include: { patient: { select: { fullName: true } }, analyses: { take: 1, include: { findings: { take: 1 } } } },
      orderBy: { studyDate: "desc" },
      take: 4,
    }),
    db.followUp.findMany({
      where: { status: "SCHEDULED", scheduledAt: { gte: new Date(), lte: in30 }, patient: scope },
      include: { patient: { select: { id: true, fullName: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 4,
    }),
  ]);

  // Latest risk per patient (doctor's final decision wins over AI)
  const latestRisk = new Map<string, RiskCategory>();
  for (const s of studies) {
    const a = s.analyses[0];
    const risk = a?.review?.finalRisk ?? a?.findings[0]?.risk;
    if (risk) latestRisk.set(s.patientId, risk);
  }
  const highRisk = [...latestRisk.values()].filter((r) => r === "HIGH" || r === "SUSPICIOUS").length;

  // Monthly chart — last 6 months
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return { key: `${d.getFullYear()}-${d.getMonth()}`, row: { month: d.toLocaleDateString("ar-EG", { month: "short" }), low: 0, moderate: 0, high: 0, suspicious: 0 } as MonthRow };
  });
  for (const s of studies) {
    const m = months.find((x) => x.key === `${s.studyDate.getFullYear()}-${s.studyDate.getMonth()}`);
    const r = s.analyses[0]?.findings[0]?.risk;
    if (!m || !r) continue;
    m.row[r === "BENIGN" || r === "LOW" ? "low" : r === "MODERATE" ? "moderate" : r === "HIGH" ? "high" : "suspicious"]++;
  }

  const kpis = [
    { label: "المرضى", value: patientCount, icon: Users, cls: "bg-brand-50 text-brand-600", href: "/doctor/patients" },
    { label: "بانتظار مراجعتك", value: pending.length, icon: ClipboardList, cls: "bg-coral-500/10 text-coral-600", href: "/doctor/studies" },
    { label: "عالية الخطورة", value: highRisk, icon: AlertTriangle, cls: "bg-red-50 text-red-600", href: "/doctor/patients" },
    { label: "متابعات هذا الشهر", value: followUps.length, icon: CalendarClock, cls: "bg-brand-50 text-brand-600", href: "/doctor/follow-ups" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold text-ink">أهلًا، {session.user.name}</h1>
        <p className="mt-1 text-ink-soft">{new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })}</p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="مؤشرات">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="group rounded-2xl border border-brand-100 bg-white p-5 shadow-sm transition hover:border-brand-300">
            <div className="flex items-center justify-between">
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${k.cls}`}>
                <k.icon className="h-5 w-5" aria-hidden />
              </span>
              <ChevronLeft className="h-4 w-4 text-ink-muted opacity-0 transition group-hover:opacity-100" aria-hidden />
            </div>
            <p className="mt-4 text-3xl font-extrabold text-ink">{k.value}</p>
            <p className="text-sm text-ink-soft">{k.label}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle action={<Link href="/doctor/studies" className="text-sm font-semibold text-brand-600">الكل</Link>}>بانتظار مراجعتك</CardTitle>
          {pending.length === 0 ? (
            <EmptyState text="لا توجد نتائج بانتظار المراجعة" />
          ) : (
            <ul className="space-y-2">
              {pending.map((s) => {
                const f = s.analyses[0]?.findings[0];
                return (
                  <li key={s.id}>
                    <Link href={`/doctor/studies/${s.id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-brand-50">
                      <div>
                        <p className="font-bold text-ink">{s.patient.fullName}</p>
                        <p className="text-xs text-ink-muted">{s.studyDate.toLocaleDateString("ar-EG")}</p>
                      </div>
                      {f && <RiskBadge risk={f.risk} tirads={f.tiradsLevel} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>المواعيد القادمة</CardTitle>
          {followUps.length === 0 ? (
            <EmptyState text="لا توجد مواعيد قريبة" />
          ) : (
            <ul className="space-y-2">
              {followUps.map((f) => (
                <li key={f.id}>
                  <Link href={`/doctor/patients/${f.patient.id}`} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-brand-50">
                    <span className="w-14 shrink-0 rounded-lg bg-brand-50 py-1.5 text-center text-xs font-bold leading-tight text-brand-700">
                      {f.scheduledAt.toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold text-ink">{f.patient.fullName}</span>
                      <span className="block truncate text-xs text-ink-soft">{f.reason}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>الإشاعات حسب درجة الخطورة — آخر 6 شهور</CardTitle>
        <StudiesChart data={months.map((m) => m.row)} />
      </Card>
    </div>
  );
}
