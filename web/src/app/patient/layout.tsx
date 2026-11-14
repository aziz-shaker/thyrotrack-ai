import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Logo } from "@/components/brand/Logo";
import { PatientNav, SignOutButton } from "./PatientNav";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "PATIENT") redirect("/doctor");
  const unread = await db.message.count({ where: { recipientId: session.user.id, readAt: null } });

  return (
    <div className="min-h-screen bg-[#F3F6F8]">
      <header className="border-b border-navy-100 bg-white">
        <div className="mx-auto flex h-20 max-w-5xl items-center gap-4 px-4">
          <Logo />
          <div className="ms-auto flex items-center gap-3">
            <span className="hidden text-sm font-semibold text-navy-800 sm:block">{session.user.name}</span>
            <SignOutButton />
          </div>
        </div>
        <PatientNav unread={unread} />
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
