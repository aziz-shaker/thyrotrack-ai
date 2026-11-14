import Link from "next/link";
import clsx from "clsx";

/** URL-driven tabs (?tab=...) — server-rendered, shareable, back-button friendly */
export function Tabs({ base, active, tabs }: { base: string; active: string; tabs: { id: string; label: string; count?: number }[] }) {
  return (
    <nav className="flex gap-1 border-b border-brand-100" role="tablist" aria-label="أقسام الملف">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <Link
            key={t.id}
            href={`${base}?tab=${t.id}`}
            role="tab"
            aria-selected={on}
            scroll={false}
            className={clsx(
              "-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition",
              on ? "border-brand-500 text-brand-700" : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={clsx("rounded-full px-2 text-xs", on ? "bg-brand-100 text-brand-700" : "bg-ink/5 text-ink-muted")}>{t.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
