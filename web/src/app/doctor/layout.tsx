import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { patientScope } from "@/lib/access";
import { Sidebar } from "@/components/doctor/Sidebar";
import { Topbar } from "@/components/doctor/Topbar";

const ROLE_AR = { ADMIN: "مدير النظام", DOCTOR: "طبيب", RADIOLOGIST: "أخصائي أشعة", LAB_TECH: "فني معمل", PATIENT: "مريض" } as const;

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const actor = { id: session.user.id, role: session.user.role };

  const scope = await patientScope(actor);
  const [pendingReviews, unread, notifications] = await Promise.all([
    db.ultrasoundStudy.count({ where: { status: "ANALYZED", deletedAt: null, patient: scope } }),
    db.notification.count({ where: { userId: actor.id, readAt: null } }),
    db.notification.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, type: true, title: true, body: true, link: true },
    }),
  ]);

  return (
    <div className="flex min-h-screen bg-[#F3F6F8]">
      <Sidebar pendingReviews={pendingReviews} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={session.user.name ?? ""} roleLabel={ROLE_AR[actor.role]} unread={unread} notifications={notifications} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
