import Link from "next/link";
import { Facebook, Instagram, Linkedin, Youtube, Github } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const COLS = [
  { title: "روابط سريعة", links: [["عن ثايرو تراك", "#about"], ["الخدمات", "#care"], ["الأدوات الذكية", "/calculator"], ["تواصل معنا", "#contact"], ["الأسئلة الشائعة", "#contact"]] },
  { title: "الخدمات", links: [["تحليل الإشاعة", "/login"], ["المتابعة الدورية", "/login"], ["بوابة المريض", "/login?role=patient"]] },
  { title: "للفريق الطبي", links: [["دخول الأطباء", "/login"], ["توثيق الـ API", "#"], ["دليل الاستخدام", "#"]] },
];

const STANDARDS = ["ACR TI-RADS", "ATA 2015", "Bethesda", "DICOM"];

export function Footer() {
  return (
    <footer className="rounded-t-[2.5rem] bg-navy-800 text-white">
      <div className="container-page grid gap-12 py-14 lg:grid-cols-[1fr_2fr_1.2fr]">
        <div className="flex flex-col items-center gap-6 lg:items-start">
          <Logo light />
          <div className="flex gap-4">
            {[Facebook, Instagram, Youtube, Linkedin, Github].map((I, i) => (
              <a key={i} href="#" aria-label="social" className="text-white/90 hover:text-brand-300">
                <I className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLS.map((c) => (
            <div key={c.title}>
              <h3 className="mb-3 font-bold">{c.title}</h3>
              <ul className="space-y-1.5 text-sm text-white/85">
                {c.links.map(([l, h]) => (
                  <li key={l}><Link href={h} className="hover:text-brand-300">{l}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div>
          <h3 className="mb-3 font-bold">معايير طبية معتمدة</h3>
          <div className="flex flex-wrap gap-2" dir="ltr">
            {STANDARDS.map((s) => (
              <span key={s} className="rounded-full border border-white/30 px-3 py-1 text-xs font-bold">{s}</span>
            ))}
          </div>
          <h3 className="mb-3 mt-8 font-bold">اشترك في النشرة البريدية</h3>
          <form className="flex overflow-hidden rounded-lg bg-white">
            <input type="email" dir="ltr" placeholder="your@email.com" aria-label="البريد الإلكتروني" className="w-full px-4 py-3 text-sm text-ink outline-none" />
            <button className="px-5 text-sm font-bold text-navy-800">اشتراك</button>
          </form>
        </div>
      </div>
      <div className="container-page flex flex-wrap items-center justify-between gap-3 border-t border-white/15 py-5 text-xs text-white/75">
        <p>© {new Date().getFullYear()} ثايرو تراك. مشروع عرض تجريبي، وكل البيانات وهمية.</p>
        <p className="flex gap-5"><a href="#">الامتثال</a><a href="#">سياسة الخصوصية</a></p>
      </div>
    </footer>
  );
}
