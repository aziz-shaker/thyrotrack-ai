import clsx from "clsx";

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("rounded-2xl border border-brand-100 bg-white p-6 shadow-sm", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="rounded-lg bg-brand-50/60 py-8 text-center text-sm text-ink-muted">{text}</p>;
}
