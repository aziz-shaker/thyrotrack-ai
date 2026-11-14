"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X, FileImage } from "lucide-react";

type Item = { file: File; view: "TRANSVERSE" | "SAGITTAL" | "UNKNOWN"; spacing: string; preview: string | null };

const MAX_MB = 15;
const ACCEPT = ".dcm,.png,.jpg,.jpeg,application/dicom,image/png,image/jpeg";

export function UploadForm({ patients, defaultPatientId }: { patients: { id: string; fullName: string; mrn: string }[]; defaultPatientId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [patientId, setPatientId] = useState(defaultPatientId);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [indication, setIndication] = useState("");
  const [device, setDevice] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [analyze, setAnalyze] = useState(true);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function add(files: FileList | null) {
    if (!files) return;
    setError(null);
    const next: Item[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_MB * 1024 * 1024) {
        setError(`${f.name}: الحجم أكبر من ${MAX_MB} ميجابايت`);
        continue;
      }
      const isImg = f.type === "image/png" || f.type === "image/jpeg";
      // Guess the view from the file name; the doctor can change it
      const n = f.name.toLowerCase();
      const view = /sag|long/.test(n) ? "SAGITTAL" : /trans|tr[-_]/.test(n) ? "TRANSVERSE" : items.length + next.length === 0 ? "TRANSVERSE" : "SAGITTAL";
      next.push({ file: f, view, spacing: "", preview: isImg ? URL.createObjectURL(f) : null });
    }
    setItems((s) => [...s, ...next].slice(0, 8));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!patientId) return setError("اختر المريض");
    if (!items.length) return setError("أضف صورة واحدة على الأقل");
    try {
      setStage("إنشاء الفحص");
      const s = await fetch(`/api/patients/${patientId}/studies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studyDate: date, indication: indication || undefined, device: device || undefined }),
      });
      const study = await s.json();
      if (!s.ok) throw new Error(study.error);

      setStage("رفع الصور");
      const form = new FormData();
      items.forEach((it) => {
        form.append("files", it.file);
        form.append("views", it.view);
        form.append("pixelSpacing", it.spacing || "0");
      });
      const u = await fetch(`/api/studies/${study.id}/images`, { method: "POST", body: form });
      if (!u.ok) throw new Error((await u.json()).error);

      if (analyze) {
        setStage("تحليل الإشاعة بالذكاء الاصطناعي");
        const a = await fetch(`/api/studies/${study.id}/analyze`, { method: "POST" });
        if (!a.ok) {
          // Study is saved — open it so the doctor can retry the analysis
          router.push(`/doctor/studies/${study.id}`);
          return;
        }
      }
      router.push(`/doctor/studies/${study.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message || "تعذّر رفع الإشاعة");
      setStage(null);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-2xl border border-navy-100 bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-navy-800 sm:col-span-2">
          المريض
          <select required value={patientId} onChange={(e) => setPatientId(e.target.value)} className="input mt-1 font-normal">
            <option value="">اختر المريض…</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName} ({p.mrn})</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-navy-800">
          تاريخ الفحص
          <input type="date" required value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="input mt-1 font-normal" />
        </label>
        <label className="text-sm font-semibold text-navy-800">
          الجهاز (اختياري)
          <input value={device} onChange={(e) => setDevice(e.target.value)} placeholder="GE LOGIQ E10" className="input mt-1 font-normal" dir="ltr" />
        </label>
        <label className="text-sm font-semibold text-navy-800 sm:col-span-2">
          سبب الفحص (اختياري)
          <input value={indication} onChange={(e) => setIndication(e.target.value)} placeholder="متابعة دورية للعقيدة" className="input mt-1 font-normal" />
        </label>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); add(e.dataTransfer.files); }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${dragOver ? "border-brand-500 bg-brand-50" : "border-navy-100"}`}
      >
        <ImagePlus className="mx-auto h-10 w-10 text-brand-500" strokeWidth={1.5} />
        <p className="mt-3 font-semibold text-navy-800">اسحب الصور هنا أو</p>
        <button type="button" onClick={() => input.current?.click()} className="btn-outline mt-3 text-sm">اختر من الجهاز</button>
        <p className="mt-3 text-xs text-ink-muted">DICOM أو PNG أو JPG، حتى {MAX_MB} ميجابايت للصورة و 8 صور للفحص</p>
        <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </div>

      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((it, i) => (
            <li key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-navy-100 p-3">
              <span className="grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-md bg-navy-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {it.preview ? <img src={it.preview} alt="" className="h-full w-full object-cover" /> : <FileImage className="h-6 w-6 text-white/60" />}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-navy-800" dir="ltr">{it.file.name}</span>
              <select aria-label="نوع المقطع" value={it.view} onChange={(e) => setItems((s) => s.map((x, j) => (j === i ? { ...x, view: e.target.value as Item["view"] } : x)))} className="input w-auto py-1.5 text-sm">
                <option value="TRANSVERSE">مقطع عرضي</option>
                <option value="SAGITTAL">مقطع طولي</option>
                <option value="UNKNOWN">غير محدد</option>
              </select>
              <input aria-label="المعايرة mm لكل بكسل" title="المعايرة (mm/pixel) — اتركها فارغة لملفات DICOM" placeholder="mm/px" inputMode="decimal" value={it.spacing} onChange={(e) => setItems((s) => s.map((x, j) => (j === i ? { ...x, spacing: e.target.value } : x)))} className="input w-24 py-1.5 text-sm" dir="ltr" />
              <button type="button" aria-label="إزالة الصورة" onClick={() => setItems((s) => s.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="flex items-center gap-2 text-sm text-navy-800">
        <input type="checkbox" checked={analyze} onChange={(e) => setAnalyze(e.target.checked)} className="h-4 w-4 accent-navy-800" />
        حلّل الإشاعة بالذكاء الاصطناعي مباشرة بعد الرفع
      </label>

      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button disabled={!!stage} className="btn-primary w-full py-3 disabled:opacity-70">
        {stage && <Loader2 className="h-5 w-5 animate-spin" />}
        {stage ?? "رفع الإشاعة"}
      </button>
    </form>
  );
}
