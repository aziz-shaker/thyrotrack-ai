"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, Menu, MessageSquareHeart, X } from "lucide-react";
import clsx from "clsx";
import { Logo } from "@/components/brand/Logo";

const utility = [
  { label: "رأيك يهمنا", href: "#contact", icon: true },
  { label: "التوثيق", href: "#how" },
  { label: "للمطورين (API)", href: "#how" },
  { label: "الأسئلة الشائعة", href: "#contact" },
];

const main = [
  { label: "عن ثايرو تراك", href: "#about", dropdown: true },
  { label: "الخدمات", href: "#care", dropdown: true },
  { label: "الأدوات الذكية", href: "#tools", dropdown: true },
  { label: "بوابة المريض", href: "/login?role=patient", dropdown: true },
  { label: "تواصل معنا", href: "#contact" },
];

export function Navbar() {
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);

  // Hide the utility row once the user scrolls
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={clsx("sticky top-0 z-50 bg-white transition-shadow", compact && "shadow-md")}>
      <div className="container-page flex items-center gap-8 py-3">
        <Logo />

        <div className="hidden flex-1 flex-col gap-2 lg:flex">
          {/* Utility row */}
          <div className={clsx("flex items-center justify-end gap-7 overflow-hidden text-[13px] text-navy-700 transition-all", compact ? "max-h-0 opacity-0" : "max-h-8 opacity-100")}>
            {utility.map((u) => (
              <a key={u.label} href={u.href} className="flex items-center gap-1.5 hover:text-brand-600">
                {u.icon && <MessageSquareHeart className="h-4 w-4 text-brand-500" />}
                {u.label}
              </a>
            ))}
            <div className="flex rounded-full bg-navy-50 p-0.5 text-xs font-bold" role="group" aria-label="اللغة">
              <span className="rounded-full bg-navy-800 px-2.5 py-1 text-white">ع</span>
              <button className="px-2.5 py-1 text-navy-800" dir="ltr">EN</button>
            </div>
            <span className="flex items-center gap-1 font-bold text-navy-800">مصر <ChevronDown className="h-4 w-4" /></span>
          </div>

          {/* Main row */}
          <nav className="flex items-center justify-end gap-6" aria-label="القائمة الرئيسية">
            {main.map((l) => (
              <a key={l.label} href={l.href} className="flex items-center gap-1 text-[14px] font-medium text-navy-800 hover:text-brand-600">
                {l.label}
                {l.dropdown && <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
              </a>
            ))}
            <Link href="/login?role=doctor" className="btn-cta px-6 py-2.5 text-sm">احجز موعدًا</Link>
            <Link href="/login" className="border-s border-navy-100 ps-5 text-[12px] leading-tight text-navy-700">
              <span className="block text-ink-muted">الدخول إلى</span>
              <span className="block font-bold">لوحة الأطباء</span>
            </Link>
          </nav>
        </div>

        <button className="ms-auto rounded-md p-2 text-navy-800 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label={open ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={open}>
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="border-t border-navy-50 bg-white lg:hidden">
          <ul className="container-page flex flex-col py-3">
            {main.map((l) => (
              <li key={l.label}>
                <a href={l.href} onClick={() => setOpen(false)} className="flex items-center justify-between py-3 font-bold text-navy-800">
                  {l.label} <ChevronLeft className="h-4 w-4 text-ink-muted" />
                </a>
              </li>
            ))}
            <li className="mt-2 grid grid-cols-2 gap-3">
              <Link href="/login" className="btn-outline">دخول الأطباء</Link>
              <Link href="/login?role=doctor" className="btn-primary">احجز موعدًا</Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
