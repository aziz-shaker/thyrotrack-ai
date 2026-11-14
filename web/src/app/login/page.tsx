import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { LoginForm } from "./LoginForm";
import { ShieldCheck } from "lucide-react";

export const metadata = { title: "تسجيل الدخول | ThyroTrack AI" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Form side */}
      <section className="flex flex-col justify-center px-6 py-12 sm:px-16">
        <Logo />
        <h1 className="mt-10 text-3xl font-extrabold text-ink">تسجيل الدخول</h1>
        <p className="mt-2 text-ink-soft">ادخل إلى حسابك لمتابعة الحالات والتقارير.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>

      {/* Brand side */}
      <aside className="relative hidden overflow-hidden bg-navy-800 p-16 text-white lg:flex lg:flex-col lg:justify-end">
        <div className="absolute -end-20 -top-20 h-96 w-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 start-10 h-72 w-72 rounded-full bg-brand-500/30" />
        <div className="relative">
          <h2 className="text-4xl font-extrabold leading-tight">دقة الذكاء الاصطناعي، وقرار الطبيب.</h2>
          <p className="mt-4 max-w-md text-lg text-white/85">
            كل نتيجة يقترحها النظام تُراجع وتُعتمد من الطبيب قبل أن تصل للمريض.
          </p>
          <p className="mt-8 flex items-center gap-2 text-sm text-white/80">
            <ShieldCheck className="h-4 w-4" /> جلسات مشفّرة · سجل تدقيق لكل عملية حساسة
          </p>
        </div>
      </aside>
    </main>
  );
}
