"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Mail } from "lucide-react";

// Demo accounts (seed data) — shown only to make the portfolio demo easy
const DEMO = [
  { label: "طبيب", email: "dr.sara@thyrotrack.demo" },
  { label: "أشعة", email: "dr.omar@thyrotrack.demo" },
  { label: "مريض", email: "patient1@thyrotrack.demo" },
  { label: "أدمن", email: "admin@thyrotrack.demo" },
];
const DEMO_PASSWORD = "Demo@1234";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (!res || res.error) {
      setError(res?.error === "RATE_LIMIT" ? "محاولات كثيرة، حاول بعد 15 دقيقة." : "البريد أو كلمة المرور غير صحيحة.");
      setLoading(false);
      return;
    }
    const session = await getSession();
    router.replace(session?.user.role === "PATIENT" ? "/patient" : "/doctor");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={submit} className="mt-8 max-w-md space-y-5" noValidate>
        <Field icon={Mail} label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field icon={Lock} label="كلمة المرور" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <button disabled={loading} className="btn-primary w-full py-3 text-base disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} دخول
        </button>
      </form>

      <div className="mt-10 max-w-md rounded-xl border border-dashed border-brand-200 bg-brand-50 p-4">
        <p className="text-sm font-semibold text-brand-800">حسابات تجريبية (كلمة المرور: <span dir="ltr">{DEMO_PASSWORD}</span>)</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => {
                setEmail(d.email);
                setPassword(DEMO_PASSWORD);
              }}
              className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-brand-700 shadow-sm hover:bg-brand-100"
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function Field(props: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const id = props.label;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">{props.label}</label>
      <div className="flex items-center gap-2 rounded-md border border-ink/15 bg-white px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        <props.icon className="h-4 w-4 text-ink-muted" />
        <input
          id={id}
          dir="ltr"
          type={props.type}
          required
          value={props.value}
          autoComplete={props.autoComplete}
          onChange={(e) => props.onChange(e.target.value)}
          className="w-full bg-transparent py-3 text-ink outline-none"
        />
      </div>
    </div>
  );
}
