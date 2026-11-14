"use client";

import { signOut } from "next-auth/react";
import { LogOut, Search } from "lucide-react";
import { NotificationBell, type NotificationItem } from "./NotificationBell";

export function Topbar(props: { name: string; roleLabel: string; unread: number; notifications: NotificationItem[] }) {
  return (
    <header className="sticky top-0 z-30 flex h-20 items-center gap-4 border-b border-brand-100 bg-white/90 px-4 backdrop-blur sm:px-8">
      <form action="/doctor/patients" className="flex max-w-sm flex-1 items-center gap-2 rounded-lg bg-brand-50/70 px-3">
        <Search className="h-4 w-4 text-ink-muted" aria-hidden />
        <input name="q" placeholder="بحث عن مريض…" aria-label="بحث عن مريض" className="w-full bg-transparent py-2.5 text-sm outline-none" />
      </form>

      <div className="ms-auto flex items-center gap-2">
        <NotificationBell items={props.notifications} unread={props.unread} />
        <div className="mx-2 hidden h-8 w-px bg-brand-100 sm:block" />
        <div className="hidden text-end sm:block">
          <p className="text-sm font-bold text-ink">{props.name}</p>
          <p className="text-xs text-ink-muted">{props.roleLabel}</p>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="rounded-full p-2.5 text-ink-soft hover:bg-red-50 hover:text-red-600" aria-label="تسجيل الخروج">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
