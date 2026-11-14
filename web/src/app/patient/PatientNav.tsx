"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import clsx from "clsx";

const NAV = [
  { href: "/patient", label: "حالتي" },
  { href: "/patient/reports", label: "تقاريري" },
  { href: "/patient/messages", label: "رسائل الطبيب" },
];

export function PatientNav({ unread }: { unread: number }) {
  const path = usePathname();
  return (
    <nav className="mx-auto flex max-w-5xl gap-1 px-4" aria-label="بوابة المريض">
      {NAV.map((n) => {
        const on = n.href === "/patient" ? path === n.href : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className={clsx("-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold", on ? "border-navy-800 text-navy-800" : "border-transparent text-ink-soft hover:text-navy-800")}>
            {n.label}
            {n.href === "/patient/messages" && unread > 0 && <span className="rounded-full bg-coral-500 px-2 text-xs text-white">{unread}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function SignOutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-ink-soft hover:bg-red-50 hover:text-red-600">
      <LogOut className="h-4 w-4" /> خروج
    </button>
  );
}
