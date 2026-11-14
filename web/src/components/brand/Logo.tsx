import Link from "next/link";

/** ThyroTrack wordmark: butterfly-shaped thyroid built from horizontal scan lines */
export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  const main = light ? "text-white" : "text-navy-800";
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="ThyroTrack AI - الرئيسية">
      <svg viewBox="0 0 48 40" className="h-10 w-12" aria-hidden>
        <defs>
          <clipPath id="thy">
            <path d="M24 14c-3-7-12-10-17-6S2 22 6 29s12 8 15 3c2-3 2-9 3-11 1 2 1 8 3 11 3 5 11 4 15-3s3-17-2-21-14-1-16 6z" />
          </clipPath>
        </defs>
        <g clipPath="url(#thy)">
          {Array.from({ length: 9 }).map((_, i) => (
            <rect key={i} x="0" y={4 + i * 3.6} width="48" height="2.2" rx="1.1" className={light ? "fill-white" : i % 3 === 1 ? "fill-brand-500" : "fill-navy-800"} />
          ))}
        </g>
      </svg>
      <span className={`flex flex-col leading-none ${main}`}>
        <span className={compact ? "text-[15px] font-bold" : "text-[17px] font-extrabold"}>ثايرو تراك</span>
        <span dir="ltr" className={`mt-0.5 whitespace-nowrap font-extrabold ${compact ? "text-sm tracking-normal" : "text-lg tracking-wide"}`}>
          THYROTRACK <span className={light ? "text-brand-300" : "text-brand-500"}>AI</span>
        </span>
      </span>
    </Link>
  );
}
