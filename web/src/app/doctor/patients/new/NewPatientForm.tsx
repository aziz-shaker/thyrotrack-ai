"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, UserCheck } from "lucide-react";

type Created = { id: string; mrn: string; portalEmail: string | null; tempPassword: string | null };

export function NewPatientForm() {
  const router = useRouter();
  const [f, setF] = useState({
    fullName: "",
    dateOfBirth: "",
    sex: "FEMALE",
    phone: "",
    email: "",
    medicalHistory: "",
    familyHistory: "",
    medications: "",
    allergies: "",
    createPortalAccount: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError({ text: j.error ?? "تعذّر حفظ المريض", field: j.field });
    setCreated(j);
    router.refresh();
  }

  if (created) {
    return (
      <div className="space-y-5 rounded-2xl border border-navy-100 bg-white p-6" role="status">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-green-100 text-green-700"><UserCheck className="h-5 w-5" /></span>
          <div>
            <p className="text-lg font-bold text-navy-800">تمت إضافة {f.fullName}</p>
            <p className="text-sm text-ink-soft">رقم الملف <span dir="ltr" className="font-semibold">{created.mrn}</span></p>
          </div>
        </div>

        {created.tempPassword && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-center gap-2 font-semibold text-amber-900"><KeyRound className="h-4 w-4" /> بيانات دخول بوابة المريض</p>
            <p className="mt-1 text-sm text-amber-900">سلّمها للمريض الآن. كلمة المرور تظهر هذه المرة فقط ولا تُحفظ بشكل مقروء.</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex gap-2"><dt className="w-28 text-amber-800">البريد</dt><dd dir="ltr" className="font-semibold text-navy-800">{created.portalEmail}</dd></div>
              <div className="flex items-center gap-2">
                <dt className="w-28 text-amber-800">كلمة المرور</dt>
                <dd dir="ltr" className="rounded bg-white px-2 py-0.5 font-mono font-semibold text-navy-800">{created.tempPassword}</dd>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${created.portalEmail}\n${created.tempPassword}`);
                    setCopied(true);
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-brand-700"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "نُسخت" : "نسخ"}
                </button>
              </div>
            </dl>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link href={`/doctor/studies/new?patient=${created.id}`} className="btn-primary">رفع أول إشاعة</Link>
          <Link href={`/doctor/patients/${created.id}`} className="btn-outline">فتح ملف المريض</Link>
        </div>
      </div>
    );
  }

  const invalid = (k: string) => (error?.field === k ? "ring-2 ring-red-300" : "");

  return (
    <form onSubmit={submit} className="space-y-6 rounded-2xl border border-navy-100 bg-white p-6" noValidate>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-bold text-navy-800">البيانات الأساسية</legend>
        <label className="text-sm font-semibold text-navy-800 sm:col-span-2">
          الاسم بالكامل <span className="text-red-600">*</span>
          <input required value={f.fullName} onChange={set("fullName")} className={`input mt-1 font-normal ${invalid("fullName")}`} autoComplete="off" />
        </label>
        <label className="text-sm font-semibold text-navy-800">
          تاريخ الميلاد <span className="text-red-600">*</span>
          <input required type="date" max={new Date().toISOString().slice(0, 10)} value={f.dateOfBirth} onChange={set("dateOfBirth")} className={`input mt-1 font-normal ${invalid("dateOfBirth")}`} />
        </label>
        <label className="text-sm font-semibold text-navy-800">
          الجنس <span className="text-red-600">*</span>
          <select value={f.sex} onChange={set("sex")} className="input mt-1 font-normal">
            <option value="FEMALE">أنثى</option>
            <option value="MALE">ذكر</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-navy-800">
          رقم الهاتف
          <input type="tel" dir="ltr" value={f.phone} onChange={set("phone")} placeholder="+20 10 0000 0000" className={`input mt-1 font-normal ${invalid("phone")}`} />
          <span className="mt-1 block text-xs font-normal text-ink-muted">يُحفظ مشفّرًا</span>
        </label>
        <label className="text-sm font-semibold text-navy-800">
          البريد الإلكتروني{f.createPortalAccount && <span className="text-red-600"> *</span>}
          <input type="email" dir="ltr" value={f.email} onChange={set("email")} className={`input mt-1 font-normal ${invalid("email")}`} />
        </label>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-bold text-navy-800">الملف الطبي</legend>
        <label className="text-sm font-semibold text-navy-800">
          التاريخ المرضي
          <textarea rows={2} value={f.medicalHistory} onChange={set("medicalHistory")} className="input mt-1 resize-y font-normal" placeholder="مثل: قصور غدة درقية منذ 2019" />
        </label>
        <label className="text-sm font-semibold text-navy-800">
          التاريخ العائلي
          <textarea rows={2} value={f.familyHistory} onChange={set("familyHistory")} className="input mt-1 resize-y font-normal" placeholder="مثل: أم مصابة بعقيدات درقية" />
        </label>
        <label className="text-sm font-semibold text-navy-800">
          الأدوية
          <input value={f.medications} onChange={set("medications")} className="input mt-1 font-normal" placeholder="Levothyroxine 50mcg" dir="auto" />
        </label>
        <label className="text-sm font-semibold text-navy-800">
          الحساسية
          <input value={f.allergies} onChange={set("allergies")} className="input mt-1 font-normal" dir="auto" />
        </label>
      </fieldset>

      <label className="flex items-start gap-3 rounded-xl bg-navy-50 p-4 text-sm text-navy-800">
        <input type="checkbox" checked={f.createPortalAccount} onChange={set("createPortalAccount")} className="mt-0.5 h-4 w-4 accent-navy-800" />
        <span>
          <b>إنشاء حساب في بوابة المريض</b>
          <span className="block text-ink-soft">يستطيع المريض بعدها رؤية تقاريره المعتمدة ومواعيده ومراسلتك. ستظهر كلمة مرور مؤقتة مرة واحدة.</span>
        </span>
      </label>

      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error.text}</p>}

      <button disabled={busy} className="btn-primary w-full py-3 disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} حفظ المريض
      </button>
    </form>
  );
}
