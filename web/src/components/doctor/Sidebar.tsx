"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LayoutDashboard, Users, ScanLine, FileText, CalendarClock, MessageSquare, Settings } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const NAV = [
  { href: "/doctor", label: "اللوحة الرئيسية", icon: LayoutDashboard, exact: true },
  { href: "/doctor/patients", label: "المرضى", icon: Users },
  { href: "/doctor/studies", label: "الإشاعات", icon: ScanLine },
  { href: "/doctor/reports", label: "التقارير", icon: FileText },
  { href: "/doctor/follow-ups", label: "المتابعات", icon: CalendarClock },
  { href: "/doctor/messages", label: "الرسائل", icon: MessageSquare },
];

export function Sidebar({ pendingReviews }: { pendingReviews: number }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-brand-100 bg-white lg:flex">
      <div className="flex h-20 items-center px-6">
        <Logo compact />
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="قائمة الطبيب">
        {NAV.map((n) => {
          const active = n.exact ? path === n.href : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-4 py-2.5 font-semibold transition",
                active ? "bg-navy-800 text-white shadow-sm" : "text-ink-soft hover:bg-brand-50 hover:text-brand-700",
              )}
            >
              <n.icon className="h-5 w-5" aria-hidden />
              <span className="flex-1">{n.label}</span>
              {n.href === "/doctor/studies" && pendingReviews > 0 && (
                <span className={clsx("rounded-full px-2 text-xs font-bold", active ? "bg-white text-brand-700" : "bg-coral-500 text-white")}>
                  {pendingReviews}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-brand-100 p-3">
        <Link href="#" className="flex items-center gap-3 rounded-lg px-4 py-2.5 font-semibold text-ink-soft hover:bg-brand-50">
          <Settings className="h-5 w-5" aria-hidden /> الإعدادات
        </Link>
      </div>
    </aside>
  );
}
