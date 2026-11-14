"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, Loader2 } from "lucide-react";

const STEPS = ["تجهيز الصور وتوحيد الأبعاد", "البحث عن العقدة داخل الغدة", "رسم حدود العقدة", "استخراج الصفات وحساب TI-RADS"];

export function AnalyzeButton({ studyId, imageCount }: { studyId: string; imageCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Purely indicative progress while the request runs
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 700);
    return () => clearInterval(t);
  }, [busy]);

  async function run() {
    setBusy(true);
    setStep(0);
    setError(null);
    const res = await fetch(`/api/studies/${studyId}/analyze`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "فشل التحليل");
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-navy-100 bg-white p-6">
      <h2 className="text-lg font-bold text-navy-800">تحليل الإشاعة</h2>
      <p className="mt-1 text-sm text-ink-soft">
        سيحلل النظام {imageCount} {imageCount === 1 ? "صورة" : "صور"} ويقترح مكان العقدة وتصنيفها. النتيجة تحتاج مراجعتك واعتمادك.
      </p>
      <button onClick={run} disabled={busy || imageCount === 0} className="btn-primary mt-5 w-full py-3 disabled:opacity-60">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <BrainCircuit className="h-5 w-5" />}
        {busy ? STEPS[step] : "تحليل الإشاعة بالذكاء الاصطناعي"}
      </button>
      {error && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
