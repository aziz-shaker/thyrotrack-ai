"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, TrendingUp } from "lucide-react";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
}

/** Bell with dropdown — keeps alerts out of the page body */
export function NotificationBell({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2.5 text-ink-soft hover:bg-brand-50"
        aria-label={`التنبيهات (${unread})`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute end-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-coral-500 px-1 text-[11px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-12 z-50 w-80 overflow-hidden rounded-xl border border-brand-100 bg-white shadow-card">
          <p className="border-b border-brand-50 px-4 py-3 font-bold text-ink">التنبيهات</p>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">لا توجد تنبيهات</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => {
                const danger = n.type === "HIGH_RISK" || n.type === "GROWTH_ALERT";
                const Icon = n.type === "GROWTH_ALERT" ? TrendingUp : n.type === "HIGH_RISK" ? AlertTriangle : Bell;
                return (
                  <li key={n.id}>
                    <Link href={n.link ?? "#"} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-3 hover:bg-brand-50">
                      <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${danger ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600"}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-ink">{n.title}</span>
                        <span className="block truncate text-xs text-ink-soft">{n.body}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
