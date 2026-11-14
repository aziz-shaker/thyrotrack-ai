import Link from "next/link";
import { CalendarCheck, Stethoscope, ScanSearch, MessageSquarePlus } from "lucide-react";
import { Photo, hasPhoto } from "./Photo";
import { HeroScan } from "./HeroScan";

/** Pill outlines behind a real photo (percent-based so it scales) */
const PILLS = [
  { top: "4%", right: "38%", w: "26%" },
  { top: "20%", right: "8%", w: "44%" },
  { top: "36%", right: "2%", w: "52%" },
  { top: "52%", right: "6%", w: "56%" },
  { top: "68%", right: "0%", w: "60%" },
  { top: "84%", right: "4%", w: "54%" },
];

export function Hero() {
  const photo = hasPhoto("hero");
  return (
    <section className="relative overflow-hidden bg-gradient-to-l from-surface via-[#E9F0F4] to-[#D6E2E9]">
      <div className="container-page grid min-h-[560px] items-center gap-12 py-14 lg:grid-cols-[1fr_1.1fr] lg:py-16">
        <div className="relative z-10 max-w-xl">
          <h1 className="text-display-sm font-bold text-navy-800 sm:text-display">
            تشخيص أدق،
            <br />
            متابعة أوضح.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lead text-navy-700">
            ثايرو تراك يحلل إشاعة السونار، يحدد عقيدات الغدة الدرقية ويقترح تصنيف ACR TI-RADS. القرار النهائي يبقى
            دائمًا للطبيب.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <a href="#contact" className="btn-outline">تواصل معنا</a>
            <a href="#care" className="btn-outline">اعرف كيف يعمل</a>
          </div>
        </div>

        {photo ? (
          <div className="relative h-[380px] sm:h-[480px] lg:h-[540px]">
            <div className="pill-lines absolute inset-0" aria-hidden>
              {PILLS.map((p, i) => (
                <span key={i} style={{ top: p.top, right: p.right, width: p.w }} />
              ))}
            </div>
            <Photo name="hero" alt="طبيبة مصرية تشرح نتيجة السونار لمريضة" priority className="object-contain object-bottom" fallback={null} />
          </div>
        ) : (
          <div className="pb-8">
            <HeroScan />
          </div>
        )}
      </div>

      <QuickActions />
    </section>
  );
}

const ACTIONS = [
  { icon: CalendarCheck, label: "احجز موعد متابعة", href: "/login?role=patient" },
  { icon: Stethoscope, label: "ابحث عن طبيب", href: "#care" },
  { icon: ScanSearch, label: "احسب تصنيف العقدة", href: "/calculator" },
  { icon: MessageSquarePlus, label: "أرسل استفسارًا", href: "#contact" },
];

function QuickActions() {
  return (
    <div className="relative z-10 border-t border-navy-100 bg-white">
      <ul className="grid grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((a) => (
          <li key={a.label} className="border-navy-100 [&:not(:last-child)]:border-e max-lg:[&:nth-child(-n+2)]:border-b">
            <Link href={a.href} className="flex flex-col items-center gap-3 px-4 py-7 text-center hover:bg-brand-50">
              <a.icon className="h-8 w-8 text-brand-500" strokeWidth={1.5} aria-hidden />
              <span className="text-lg font-semibold text-navy-800">{a.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
