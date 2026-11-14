import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { CalendarClock, FlaskConical, Phone, ScanLine, FileCheck2, AlertTriangle, ChevronLeft } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessPatient } from "@/lib/access";
import { decrypt } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { isSignificantGrowth } from "@/lib/tirads";
import { Card, CardTitle, EmptyState } from "@/components/ui/Card";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { Tabs } from "@/components/ui/Tabs";
import { GrowthChart } from "@/components/doctor/GrowthChart";
import { LabForm } from "@/components/doctor/LabForm";
import { can } from "@/lib/access";
import { ThyroidModelLazy } from "@/components/three/ThyroidModelLazy";
import { thyroidModel } from "@/lib/services/model3d";

export const dynamic = "force-dynamic";

const patientInclude = {
  studies: {
    where: { deletedAt: null },
    orderBy: { studyDate: "asc" },
    include: { analyses: { orderBy: { createdAt: "desc" }, take: 1, include: { findings: true, review: { include: { reviewer: { select: { name: true } } } } } } },
  },
  labResults: { where: { deletedAt: null }, orderBy: { takenAt: "desc" } },
  followUps: { orderBy: { scheduledAt: "desc" } },
} satisfies Prisma.PatientInclude;

const LOBE_AR = { RIGHT: "الفص الأيمن", LEFT: "الفص الأيسر", ISTHMUS: "البرزخ" };
const ZONE_AR = { UPPER: "علوي", MIDDLE: "أوسط", LOWER: "سفلي" };
const LAB_AR: Record<string, string> = { TSH: "TSH", FT3: "Free T3", FT4: "Free T4", FNA_CYTOLOGY: "FNA (Bethesda)" };

export default async function PatientDetail({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const actor = { id: session.user.id, role: session.user.role };

  // Row-level access check — 404 (not 403) to avoid leaking existence
  if (!/^[0-9a-f-]{36}$/i.test(params.id) || !(await canAccessPatient(actor, params.id))) notFound();

  const p = await db.patient.findUnique({
    where: { id: params.id },
    include: patientInclude,
  });
  if (!p) notFound();

  await audit({ actorId: actor.id, action: "PATIENT_VIEW", entityType: "Patient", entityId: p.id, ip: headers().get("x-forwarded-for") });

  const tab = ["overview", "studies", "model", "timeline"].includes(searchParams.tab ?? "") ? searchParams.tab! : "overview";

  // Nodule N1 trajectory across studies
  const series = p.studies
    .map((s) => ({ s, a: s.analyses[0], f: s.analyses[0]?.findings[0] }))
    .filter((x) => x.f)
    .map((x) => ({ ...x, f: x.f! }));
  const last = series.at(-1);
  const prev = series.at(-2);
  const grew =
    !!last && !!prev &&
    isSignificantGrowth(
      { l: prev.f.lengthMm, w: prev.f.widthMm, d: prev.f.depthMm, v: prev.f.volumeMl },
      { l: last.f.lengthMm, w: last.f.widthMm, d: last.f.depthMm, v: last.f.volumeMl },
    );
  const volChange = last && prev ? Math.round(((last.f.volumeMl - prev.f.volumeMl) / prev.f.volumeMl) * 100) : null;
  const ageYears = Math.floor((Date.now() - p.dateOfBirth.getTime()) / (365.25 * 86_400_000));
  const nextVisit = p.followUps.filter((f) => f.status === "SCHEDULED" && f.scheduledAt > new Date()).at(-1);

  return (
    <div className="space-y-6">
      <Link href="/doctor/patients" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-brand-600">
        المرضى <ChevronLeft className="h-4 w-4" />
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-5">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-500 text-xl font-extrabold text-white">{p.fullName[0]}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold text-ink">{p.fullName}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-ink-soft">
            <span dir="ltr">{p.mrn}</span>
            <span>{ageYears} سنة · {p.sex === "FEMALE" ? "أنثى" : "ذكر"}</span>
            <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> <span dir="ltr">{decrypt(p.phoneEnc) ?? "—"}</span></span>
          </p>
        </div>
        {last && <RiskBadge risk={last.a?.review?.finalRisk ?? last.f.risk} tirads={last.a?.review?.finalTirads ?? last.f.tiradsLevel} />}
        {(actor.role === "DOCTOR" || actor.role === "RADIOLOGIST") && (
          <Link href={`/doctor/studies/new?patient=${p.id}`} className="btn-primary text-sm">رفع إشاعة</Link>
        )}
      </div>

      {grew && (
        <div role="alert" className="flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span><b>زيادة ملحوظة في حجم العقدة</b> (معيار ATA) — الحجم تغيّر <span dir="ltr">+{volChange}%</span> منذ الفحص السابق.</span>
        </div>
      )}

      <Tabs
        base={`/doctor/patients/${p.id}`}
        active={tab}
        tabs={[
          { id: "overview", label: "نظرة عامة" },
          { id: "studies", label: "الإشاعات", count: p.studies.length },
          { id: "model", label: "النموذج 3D" },
          { id: "timeline", label: "السجل الزمني" },
        ]}
      />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardTitle>
              حجم العقدة N1{" "}
              {last && <span className="text-sm font-medium text-ink-soft">· {LOBE_AR[last.f.lobe]}، {ZONE_AR[last.f.zone]}</span>}
            </CardTitle>
            {series.length === 0 ? (
              <EmptyState text="لا توجد إشاعات بعد" />
            ) : (
              <GrowthChart
                data={series.map(({ s, f }) => ({
                  date: s.studyDate.toLocaleDateString("ar-EG", { month: "short", year: "2-digit" }),
                  volume: f.volumeMl,
                  maxDim: Math.max(f.lengthMm, f.widthMm, f.depthMm),
                }))}
              />
            )}
            {last && (
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-brand-50 pt-4 text-center">
                <Stat label="الأبعاد (mm)" value={`${last.f.lengthMm}×${last.f.widthMm}×${last.f.depthMm}`} />
                <Stat label="الحجم" value={`${last.f.volumeMl} ml`} />
                <Stat label="التغير" value={volChange === null ? "—" : `${volChange > 0 ? "+" : ""}${volChange}%`} warn={grew} />
              </dl>
            )}
          </Card>

          <div className="space-y-6">
            <Card>
              <CardTitle>آخر التحاليل</CardTitle>
              <div className="grid grid-cols-3 gap-2">
                {["TSH", "FT4", "FT3"].map((t) => {
                  const l = p.labResults.find((x) => x.type === t);
                  const high = l?.value != null && l.refHigh != null && l.value > l.refHigh;
                  return (
                    <div key={t} className={`rounded-lg p-3 text-center ${high ? "bg-red-50" : "bg-brand-50"}`}>
                      <p className="text-xs text-ink-muted" dir="ltr">{LAB_AR[t]}</p>
                      <p className={`font-extrabold ${high ? "text-red-600" : "text-brand-700"}`} dir="ltr">{l?.value ?? "—"}</p>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const fna = p.labResults.find((x) => x.type === "FNA_CYTOLOGY");
                return fna ? (
                  <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${(fna.bethesda ?? 0) >= 5 ? "bg-red-50 text-red-700" : "bg-navy-50 text-navy-800"}`}>
                    FNA: <span dir="ltr">Bethesda {fna.bethesda}</span>، {fna.takenAt.toLocaleDateString("ar-EG")}
                  </p>
                ) : null;
              })()}
              {can.enterLabs(actor.role) && <LabForm patientId={p.id} />}
            </Card>
            <Card>
              <CardTitle>الملف الطبي</CardTitle>
              <dl className="space-y-3 text-sm">
                {[
                  ["التاريخ المرضي", p.medicalHistory],
                  ["التاريخ العائلي", p.familyHistory],
                  ["الأدوية", p.medications],
                  ["الحساسية", p.allergies],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs font-semibold text-ink-muted">{k}</dt>
                      <dd className="text-ink">{v}</dd>
                    </div>
                  ))}
                {nextVisit && (
                  <div className="flex items-center gap-2 rounded-lg bg-brand-50 p-3 text-brand-800">
                    <CalendarClock className="h-4 w-4" />
                    الموعد القادم: {nextVisit.scheduledAt.toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}
                  </div>
                )}
              </dl>
            </Card>
          </div>
        </div>
      )}

      {tab === "studies" && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-brand-50 text-ink-soft">
              <tr>
                {["التاريخ", "الأبعاد (mm)", "الحجم", "التصنيف", "الحالة", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-start font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {[...series].reverse().map(({ s, a, f }) => (
                <tr key={s.id} className="hover:bg-brand-50/40">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-ink">{s.studyDate.toLocaleDateString("ar-EG")}</p>
                    <p className="text-xs text-ink-muted" dir="ltr">{s.accession}</p>
                  </td>
                  <td className="px-5 py-4" dir="ltr">{f.lengthMm} × {f.widthMm} × {f.depthMm}</td>
                  <td className="px-5 py-4" dir="ltr">{f.volumeMl} ml</td>
                  <td className="px-5 py-4"><RiskBadge risk={a?.review?.finalRisk ?? f.risk} tirads={a?.review?.finalTirads ?? f.tiradsLevel} /></td>
                  <td className="px-5 py-4 text-ink-soft">{a?.review ? "معتمد" : <span className="font-bold text-coral-600">بانتظار المراجعة</span>}</td>
                  <td className="px-5 py-4 text-end">
                    <Link href={`/doctor/studies/${s.id}`} className="font-semibold text-brand-600 hover:underline">{a?.review ? "عرض" : "مراجعة"}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "model" && <ThyroidModelLazy nodules={await thyroidModel(p.id, "clinician")} mode="doctor" />}

      {tab === "timeline" && <Timeline p={p} />}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={`mt-0.5 font-extrabold ${warn ? "text-red-600" : "text-ink"}`} dir="ltr">{value}</dd>
    </div>
  );
}

type PatientFull = Prisma.PatientGetPayload<{ include: typeof patientInclude }>;

function Timeline({ p }: { p: PatientFull }) {
  type Ev = { date: Date; icon: typeof ScanLine; title: string; detail?: string; href?: string; warn?: boolean };
  const events: Ev[] = [
    ...p.studies.flatMap((s) => {
      const r = s.analyses[0]?.review;
      const evs: Ev[] = [{ date: s.studyDate, icon: ScanLine, title: "إشاعة سونار", detail: s.indication ?? undefined, href: `/doctor/studies/${s.id}` }];
      if (r?.signedAt) evs.push({ date: r.signedAt, icon: FileCheck2, title: `اعتماد التقرير · TR${r.finalTirads}`, detail: r.reviewer.name });
      return evs;
    }),
    ...p.labResults.map((l) => ({
      date: l.takenAt,
      icon: FlaskConical,
      title: `تحليل ${LAB_AR[l.type] ?? l.type}`,
      detail: l.bethesda ? `Bethesda ${l.bethesda}` : `${l.value} ${l.unit ?? ""}`,
      warn: (l.bethesda ?? 0) >= 5 || (l.value != null && l.refHigh != null && l.value > l.refHigh),
    })),
    ...p.followUps.map((f) => ({ date: f.scheduledAt, icon: CalendarClock, title: f.reason, detail: f.status === "SCHEDULED" ? "موعد قادم" : "تم" })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <Card>
      <ol className="relative ms-3 space-y-6 border-s-2 border-brand-100 ps-7">
        {events.map((e, i) => (
          <li key={i} className="relative">
            <span className={`absolute -start-[42px] grid h-7 w-7 place-items-center rounded-full text-white ring-4 ring-white ${e.warn ? "bg-red-500" : "bg-brand-500"}`}>
              <e.icon className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs text-ink-muted">{e.date.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })}</p>
            {e.href ? <Link href={e.href} className="font-bold text-ink hover:text-brand-600">{e.title}</Link> : <p className="font-bold text-ink">{e.title}</p>}
            {e.detail && <p className="text-sm text-ink-soft" dir="auto">{e.detail}</p>}
          </li>
        ))}
      </ol>
    </Card>
  );
}
