"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

const TYPES = { TSH: "TSH", FT4: "Free T4", FT3: "Free T3", ANTI_TPO: "Anti-TPO", THYROGLOBULIN: "Thyroglobulin", CALCITONIN: "Calcitonin", FNA_CYTOLOGY: "FNA (Bethesda)" };
const BETHESDA = ["I: غير تشخيصية", "II: حميدة", "III: غير محددة (AUS)", "IV: ورم جريبي محتمل", "V: مشتبه بالخبث", "VI: خبيثة"];

/** Inline form for lab technicians / clinicians to add a lab or cytology result. */
export function LabForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<keyof typeof TYPES>("TSH");
  const [value, setValue] = useState("");
  const [bethesda, setBethesda] = useState(2);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-brand-700">
        <Plus className="h-4 w-4" /> إضافة نتيجة تحليل
      </button>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/patients/${patientId}/labs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, takenAt: date, ...(type === "FNA_CYTOLOGY" ? { bethesda } : { value: Number(value) }) }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(j.error ?? "تعذّر الحفظ");
    setOpen(false);
    setValue("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 border-t border-navy-50 pt-4">
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="نوع التحليل" value={type} onChange={(e) => setType(e.target.value as keyof typeof TYPES)} className="input py-2 text-sm" dir="ltr">
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input aria-label="تاريخ التحليل" type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="input py-2 text-sm" />
      </div>
      {type === "FNA_CYTOLOGY" ? (
        <select aria-label="تصنيف Bethesda" value={bethesda} onChange={(e) => setBethesda(Number(e.target.value))} className="input py-2 text-sm">
          {BETHESDA.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
        </select>
      ) : (
        <input aria-label="القيمة" required inputMode="decimal" type="number" step="0.01" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder="القيمة" className="input py-2 text-sm" dir="ltr" />
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="btn-primary flex-1 py-2 text-sm">{busy && <Loader2 className="h-4 w-4 animate-spin" />} حفظ</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-outline flex-1 py-2 text-sm">إلغاء</button>
      </div>
    </form>
  );
}
