import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, UserPlus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { patientScope } from "@/lib/access";
import { Card, EmptyState } from "@/components/ui/Card";
import { RiskBadge } from "@/components/ui/RiskBadge";

export const dynamic = "force-dynamic";

const age = (dob: Date) => Math.floor((Date.now() - dob.getTime()) / (365.25 * 86_400_000));

export default async function PatientsPage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const scope = await patientScope({ id: session.user.id, role: session.user.role });
  const q = searchParams.q?.trim().slice(0, 80);

  const patients = await db.patient.findMany({
    where: {
      AND: [scope, q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { mrn: { contains: q, mode: "insensitive" } }] } : {}],
    },
    include: {
      studies: {
        where: { deletedAt: null },
        orderBy: { studyDate: "desc" },
        take: 1,
        include: { analyses: { take: 1, include: { findings: { take: 1 }, review: true } } },
      },
      followUps: { where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } }, orderBy: { scheduledAt: "asc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">المرضى</h1>
          <p className="text-ink-soft">{patients.length} مريض مُسند إليك</p>
        </div>
        {(session.user.role === "DOCTOR" || session.user.role === "RADIOLOGIST") && (
          <Link href="/doctor/patients/new" className="btn-cta">
            <UserPlus className="h-4 w-4" /> إضافة مريض
          </Link>
        )}
      </div>

      <form className="flex max-w-lg items-center gap-2 rounded-lg border border-ink/10 bg-white px-3 shadow-sm">
        <Search className="h-4 w-4 text-ink-muted" aria-hidden />
        <input name="q" defaultValue={q} placeholder="ابحث بالاسم أو رقم الملف" aria-label="بحث" className="w-full bg-transparent py-3 outline-none" />
      </form>

      <Card className="overflow-x-auto p-0">
        {patients.length === 0 ? (
          <div className="p-6"><EmptyState text={q ? `لا يوجد نتائج لـ "${q}"` : "لا يوجد مرضى مسندين إليك"} /></div>
        ) : (
          <table className="w-full min-w-[760px] text-start text-sm">
            <thead className="bg-brand-50 text-ink-soft">
              <tr>
                {["المريض", "العمر / الجنس", "آخر إشاعة", "التصنيف الحالي", "المتابعة القادمة", ""].map((h) => (
                  <th key={h} scope="col" className="px-5 py-3 text-start font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {patients.map((p) => {
                const s = p.studies[0];
                const a = s?.analyses[0];
                const f = a?.findings[0];
                const risk = a?.review?.finalRisk ?? f?.risk;
                const tir = a?.review?.finalTirads ?? f?.tiradsLevel;
                return (
                  <tr key={p.id} className="hover:bg-brand-50/40">
                    <td className="px-5 py-4">
                      <p className="font-bold text-ink">{p.fullName}</p>
                      <p className="text-xs text-ink-muted" dir="ltr">{p.mrn}</p>
                    </td>
                    <td className="px-5 py-4 text-ink-soft">{age(p.dateOfBirth)} سنة · {p.sex === "FEMALE" ? "أنثى" : "ذكر"}</td>
                    <td className="px-5 py-4 text-ink-soft">
                      {s ? s.studyDate.toLocaleDateString("ar-EG") : "—"}
                      {s?.status === "ANALYZED" && <span className="ms-2 rounded bg-coral-500/10 px-1.5 py-0.5 text-xs font-bold text-coral-600">بانتظار المراجعة</span>}
                    </td>
                    <td className="px-5 py-4">{risk ? <RiskBadge risk={risk} tirads={tir} /> : "—"}</td>
                    <td className="px-5 py-4 text-ink-soft">{p.followUps[0]?.scheduledAt.toLocaleDateString("ar-EG") ?? "—"}</td>
                    <td className="px-5 py-4 text-end">
                      <Link href={`/doctor/patients/${p.id}`} className="font-semibold text-brand-600 hover:underline">فتح الملف</Link>
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
