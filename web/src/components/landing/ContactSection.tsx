"use client";

import { useState } from "react";
import { CheckCircle2, Facebook, Instagram, Linkedin, Paperclip, Youtube, Github } from "lucide-react";

/** Contact card on a patterned background (demo form — no message is actually sent) */
export function ContactSection() {
  const [sent, setSent] = useState(false);
  const [agreed, setAgreed] = useState(false);

  return (
    <section
      id="contact"
      className="py-20"
      style={{
        backgroundColor: "#F3F6F8",
        backgroundImage: "radial-gradient(rgba(10,61,87,0.07) 1.5px, transparent 1.5px)",
        backgroundSize: "14px 14px",
      }}
    >
      <div className="container-page">
        <div className="mx-auto grid max-w-5xl gap-10 rounded-3xl bg-white p-8 shadow-sm sm:p-12 lg:grid-cols-2">
          <div className="flex flex-col">
            <h2 className="text-3xl font-bold text-navy-800">تواصل معنا</h2>
            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="text-navy-700">البريد الإلكتروني:</dt>
                <dd className="mt-1 font-semibold text-navy-800" dir="ltr">info@thyrotrack.demo</dd>
              </div>
              <div>
                <dt className="text-navy-700">الهاتف:</dt>
                <dd className="mt-1 font-semibold text-navy-800" dir="ltr">+20 2 0000 0000 · مصر</dd>
              </div>
            </dl>
            <div className="mt-auto pt-10">
              <p className="text-sm text-navy-700">تابعنا:</p>
              <div className="mt-2 flex gap-2">
                {[Facebook, Instagram, Youtube, Linkedin, Github].map((I, i) => (
                  <a key={i} href="#" aria-label="social" className="grid h-7 w-7 place-items-center rounded-full bg-navy-800 text-white hover:bg-brand-500">
                    <I className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {sent ? (
            <div className="grid place-items-center text-center" role="status">
              <div>
                <CheckCircle2 className="mx-auto h-14 w-14 text-brand-500" />
                <p className="mt-4 text-xl font-bold text-navy-800">تم استلام رسالتك</p>
                <p className="mt-1 text-sm text-navy-700">هذا نموذج تجريبي، لم تُرسل أي بيانات.</p>
              </div>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-navy-700">
                  الاسم
                  <input required className="input mt-1" />
                </label>
                <label className="text-sm text-navy-700">
                  البريد الإلكتروني
                  <input required type="email" dir="ltr" className="input mt-1" />
                </label>
              </div>
              <label className="block text-sm text-navy-700">
                الرسالة
                <textarea required rows={6} placeholder="اكتب رسالتك…" className="input mt-1 resize-none" />
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md bg-navy-50 px-3 py-2.5 text-sm italic text-navy-700">
                <Paperclip className="h-4 w-4" /> إرفاق ملف (اختياري)
                <input type="file" className="sr-only" accept=".pdf,.jpg,.png" />
              </label>
              <p className="text-[11px] text-ink-muted">PDF أو JPG أو PNG حتى 4 ميجابايت</p>
              <label className="flex items-start gap-2 text-sm text-navy-700">
                <input type="checkbox" required checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4 accent-navy-800" />
                قرأت <a href="#" className="underline">سياسة الخصوصية</a> وأوافق على معالجة بياناتي.
              </label>
              <button disabled={!agreed} className="btn-primary w-full py-3 disabled:opacity-50">إرسال الرسالة</button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
