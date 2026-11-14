/** Skeleton shown while dashboard data loads */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true" aria-label="جاري التحميل">
      <div className="h-8 w-56 rounded bg-brand-100" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-white" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="h-72 rounded-2xl bg-white lg:col-span-3" />
        <div className="h-72 rounded-2xl bg-white lg:col-span-2" />
      </div>
    </div>
  );
}
