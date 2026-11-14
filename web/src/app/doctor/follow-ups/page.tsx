import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { patientScope } from "@/lib/access";
import { Card, CardTitle, EmptyState } from "@/components/ui/Card";
import { FollowUpForm, FollowUpStatusButtons } from "./FollowUpClient";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const scope = await patientScope({ id: session.user.id, role: session.user.role });
  const now = new Date();
  const [upcoming, past, patients] = await Promise.all([
    db.followUp.findMany({ where: { patient: scope, status: "SCHEDULED", scheduledAt: { gte: now } }, include: { patient: { select: { id: true, fullName: true } } }, orderBy: { scheduledAt: "asc" } }),
    db.followUp.findMany({ where: { patient: scope, OR: [{ status: { not: "SCHEDULED" } }, { scheduledAt: { lt: now } }] }, include: { patient: { select: { id: true, fullName: true } } }, orderBy: { scheduledAt: "desc" }, take: 20 }),
    db.patient.findMany({ where: scope, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);
  const canEdit = session.user.role === "DOCTOR" || session.user.role === "RADIOLOGIST";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-800">المتابعات</h1>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardTitle>المواعيد القادمة</CardTitle>
          {upcoming.length === 0 ? (
            <EmptyState text="لا توجد مواعيد قادمة. حدد موعدًا من النموذج." />
          ) : (
            <ul className="divide-y divide-navy-50">
              {upcoming.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-4 py-3">
                  <span className="w-16 shrink-0 rounded-lg bg-navy-50 py-2 text-center text-xs font-semibold leading-tight text-navy-800">
                    {f.scheduledAt.toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/doctor/patients/${f.patient.id}`} className="font-semibold text-navy-800 hover:text-brand-600">{f.patient.fullName}</Link>
                    <p className="truncate text-sm text-ink-soft">{f.reason}</p>
                  </div>
                  {canEdit && <FollowUpStatusButtons id={f.id} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
        {canEdit && (
          <Card>
            <CardTitle>تحديد موعد متابعة</CardTitle>
            <FollowUpForm patients={patients} />
          </Card>
        )}
      </div>

      <Card>
        <CardTitle>السابقة</CardTitle>
        {past.length === 0 ? (
          <EmptyState text="لا توجد مواعيد سابقة" />
        ) : (
          <ul className="divide-y divide-navy-50 text-sm">
            {past.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-navy-800">{f.patient.fullName}، {f.reason}</span>
                <span className="text-ink-muted">
                  {f.scheduledAt.toLocaleDateString("ar-EG")}، {{ SCHEDULED: "لم يُسجَّل", COMPLETED: "تم", MISSED: "لم يحضر", CANCELLED: "أُلغي" }[f.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
