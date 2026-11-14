import Link from "next/link";
import { Quote, ScanLine, LineChart, HeartHandshake, Calculator, Ruler, Syringe, FlaskConical } from "lucide-react";
import { Photo } from "./Photo";

/* ---------- Section heading ---------- */
function Heading({ title, text, light }: { title: string; text?: string; light?: boolean }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <h2 className={`text-3xl font-bold sm:text-4xl ${light ? "text-white" : "text-navy-800"}`}>{title}</h2>
      {text && <p className={`mt-4 text-lg leading-8 ${light ? "text-white/90" : "text-navy-700"}`}>{text}</p>}
    </div>
  );
}

/* ---------- Care cards (photo + title + navy button) ---------- */
const CARE = [
  {
    photo: "care-diagnosis",
    title: "تحليل الإشاعة",
    text: "كشف العقدة ورسم حدودها وقياسها وتصنيفها خلال ثوانٍ.",
    icon: ScanLine,
    href: "/login?role=doctor",
    cta: "ابدأ التحليل",
  },
  {
    photo: "care-followup",
    title: "المتابعة الدورية",
    text: "مقارنة تلقائية بين الفحوصات وتنبيه عند زيادة الحجم.",
    icon: LineChart,
    href: "/login?role=doctor",
    cta: "تابع حالاتك",
  },
  {
    photo: "care-patient",
    title: "بوابة المريض",
    text: "تقارير مبسطة، نموذج 3D للغدة، ومواعيد ورسائل مع الطبيب.",
    icon: HeartHandshake,
    href: "/login?role=patient",
    cta: "ادخل بوابتك",
  },
];

export function CareCards() {
  return (
    <section id="care" className="bg-white py-20">
      <div className="container-page">
        <Heading
          title="رعاية متكاملة في كل مرحلة"
          text="من أول صورة سونار حتى التقرير المعتمد: فريق الأشعة والغدد والمريض على منصة واحدة، وقرار الطبيب هو الأساس دائمًا."
        />
        <div className="mx-auto mt-14 grid max-w-5xl gap-8 md:grid-cols-3">
          {CARE.map((c) => (
            <article key={c.title} className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm">
              <div className="relative h-60 bg-gradient-to-br from-navy-50 to-brand-100">
                <Photo
                  name={c.photo}
                  alt={c.title}
                  fallback={
                    <div className="grid h-full place-items-center">
                      <span className="grid h-24 w-24 place-items-center rounded-full bg-white/70 text-brand-500 shadow-sm">
                        <c.icon className="h-11 w-11" strokeWidth={1.5} />
                      </span>
                    </div>
                  }
                />
              </div>
              <div className="p-6">
                <h3 className="text-2xl font-bold text-navy-800">{c.title}</h3>
                <p className="mt-2 min-h-12 text-sm leading-6 text-navy-700">{c.text}</p>
                <Link href={c.href} className="btn-primary mt-5 text-sm">{c.cta}</Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Egypt map + stats (navy band) ---------- */
const PINS = [
  { name: "الإسكندرية", x: 168, y: 62 },
  { name: "المنصورة", x: 238, y: 68 },
  { name: "القاهرة", x: 228, y: 104 },
  { name: "أسيوط", x: 214, y: 214 },
  { name: "أسوان", x: 262, y: 330 },
];

const STATS = [
  { v: "< 10 ث", l: "زمن تحليل الإشاعة" },
  { v: "5", l: "فئات ACR TI-RADS" },
  { v: "100%", l: "مراجعة الطبيب قبل الاعتماد" },
  { v: "4", l: "نماذج AI قابلة للتبديل" },
  { v: "5", l: "أدوار وصلاحيات" },
  { v: "24/7", l: "بوابة المريض" },
];

export function RegionStats() {
  return (
    <section id="about" className="bg-navy-800 py-20 text-white">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl">رعاية أذكى، أقرب إليك في كل محافظة</h2>
          <dl className="mt-10 grid grid-cols-2 gap-y-10 sm:grid-cols-3">
            {STATS.map((s, i) => (
              <div key={s.l} className={`px-4 ${i % 3 !== 0 ? "sm:border-s sm:border-white/20" : ""}`}>
                <dt className="sr-only">{s.l}</dt>
                <dd className="text-4xl font-bold text-brand-400" dir="ltr">{s.v}</dd>
                <dd className="mt-2 text-sm font-bold text-white/90">{s.l}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-xs text-white/50">* مواقع وأرقام توضيحية لأغراض العرض التجريبي.</p>
        </div>

        <svg viewBox="0 0 420 400" className="mx-auto w-full max-w-md" role="img" aria-label="خريطة مصر توضح مواقع المراكز">
          <path
            d="M40 62 L118 70 L170 58 L200 52 L235 42 L262 48 L292 54 L335 44 L346 108 L318 160 L300 192 L288 150 L268 104 L264 110 L276 150 L290 195 L310 240 L340 295 L368 340 L388 362 L40 362 Z"
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          {/* Nile */}
          <path d="M226 110 C222 150 210 190 218 230 C226 270 246 300 262 336" fill="none" stroke="#2DB2E8" strokeOpacity="0.45" strokeWidth="2" />
          {PINS.map((p) => (
            <g key={p.name} transform={`translate(${p.x} ${p.y})`}>
              <ellipse cx="0" cy="2" rx="9" ry="3" fill="none" stroke="#2DB2E8" strokeOpacity="0.6" />
              <path d="M0 0 C-7 -9 -9 -14 -9 -18 a9 9 0 0 1 18 0 c0 4 -2 9 -9 18z" fill="none" stroke="#2DB2E8" strokeWidth="2" />
              <circle cx="0" cy="-18" r="3" fill="#2DB2E8" />
              <text x="14" y="-12" fill="#fff" fontSize="13" fontWeight="700">{p.name}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

/* ---------- Cyan band: use cases by role (not patient testimonials) ---------- */
const VOICES = [
  { role: "استشاري الغدد", text: "أرى تطور العقدة في رسم واحد، ويصلني تنبيه تلقائي لو زاد الحجم وفق معيار ATA." },
  { role: "أخصائي الأشعة", text: "النظام يرسم حدود العقدة ويقترح التصنيف، وأنا أعدّل الحدود وأعتمد النتيجة النهائية." },
  { role: "المريض", text: "أفهم حالتي بلغة بسيطة، وأرى مكان العقدة على نموذج ثلاثي الأبعاد للغدة." },
  { role: "فني المعمل", text: "أرفع نتائج TSH و T4 و FNA مباشرة في ملف المريض، فتظهر للطبيب فورًا." },
  { role: "إدارة المركز", text: "سجل تدقيق كامل لكل عملية حساسة، وصلاحيات دقيقة لكل طبيب ومريض." },
];

export function VoicesBand() {
  return (
    <section className="py-20">
      <div className="container-page">
        <div className="rounded-3xl bg-brand-500 px-4 py-14 sm:px-10">
          <Heading title="مصمم لكل فرد في الفريق" text="كل دور له شاشته وصلاحياته، والطبيب صاحب القرار النهائي." light />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {VOICES.map((v) => (
              <li key={v.role} className="relative flex flex-col rounded-2xl bg-white p-5 pb-16 shadow-sm">
                <span className="grid h-6 w-6 place-items-center rounded bg-brand-500 text-white">
                  <Quote className="h-3.5 w-3.5" fill="currentColor" />
                </span>
                <p className="mt-3 flex-1 text-sm leading-6 text-navy-700">{v.text}</p>
                <p className="mt-3 font-bold text-navy-800">{v.role}</p>
                <span className="absolute -bottom-3 end-4 grid h-14 w-14 place-items-center rounded-xl bg-brand-500 text-white shadow-md">
                  <Quote className="h-7 w-7 rotate-180" fill="currentColor" />
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-10 text-center">
          <Link href="/login" className="btn-primary px-8">جرّب النظام الآن</Link>
        </div>
      </div>
    </section>
  );
}

/* ---------- Smart tools (calculator cards) ---------- */
const TOOLS = [
  { icon: Calculator, title: "حاسبة TI-RADS", text: "احسب نقاط العقدة وتصنيفها فورًا.", href: "/calculator#tirads" },
  { icon: Ruler, title: "حاسبة حجم العقدة", text: "الحجم من الأبعاد الثلاثة.", href: "/calculator#tirads" },
  { icon: Syringe, title: "هل تحتاج FNA؟", text: "حسب التصنيف وحجم العقدة.", href: "/calculator#tirads" },
  { icon: FlaskConical, title: "تفسير TSH", text: "فهم نتيجة تحليل الغدة.", href: "/calculator#tsh" },
];

export function ToolsSection() {
  return (
    <section id="tools" className="grid lg:grid-cols-2">
      <div className="relative flex min-h-[460px] flex-col items-center bg-gradient-to-b from-white to-navy-50 px-6 pt-16">
        <h2 className="text-center text-3xl font-bold leading-tight text-navy-800 sm:text-4xl">
          افهم نتيجتك
          <br />
          في ثوانٍ<span className="text-brand-500">.</span>
        </h2>
        <div className="relative mt-8 w-full max-w-sm flex-1">
          <Photo
            name="tools-doctor"
            alt="طبيب مصري يحمل نموذج الغدة الدرقية"
            className="object-contain object-bottom"
            fallback={
              <div className="absolute inset-x-0 bottom-0 mx-auto h-64 w-64 rounded-t-full bg-gradient-to-t from-brand-200 to-brand-50">
                <svg viewBox="0 0 48 40" className="absolute inset-0 m-auto w-36 fill-brand-500" aria-hidden>
                  <path d="M24 14c-3-7-12-10-17-6S2 22 6 29s12 8 15 3c2-3 2-9 3-11 1 2 1 8 3 11 3 5 11 4 15-3s3-17-2-21-14-1-16 6z" />
                </svg>
              </div>
            }
          />
        </div>
      </div>
      <div className="bg-navy-50 px-6 py-16 sm:px-12">
        <p className="text-center text-xl font-bold text-navy-800">أدوات سريعة لفهم حالة الغدة الدرقية وتقدير الخطورة.</p>
        <div className="mx-auto mt-10 grid max-w-2xl gap-5 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <div key={t.title} className="rounded-2xl border border-navy-100 bg-white p-6">
              <t.icon className="h-7 w-7 text-brand-500" strokeWidth={1.6} />
              <h3 className="mt-3 text-lg font-bold text-navy-800">{t.title}</h3>
              <p className="text-sm text-navy-700">{t.text}</p>
              <Link href={t.href} className="btn-primary mt-4 px-4 py-2 text-sm">احسب الآن</Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
