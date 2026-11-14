"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Bot, Stethoscope, Loader2, ShieldCheck, AlertTriangle, Undo2 } from "lucide-react";
import { scoreTirads, suggestAction, riskFromLevel, ellipsoidVolumeMl, RISK_META } from "@/lib/tirads";
import { FEATURE_AR, FEATURE_NAME_AR, RECOMMENDATION_AR, DECISION_AR, LOBE_AR, ZONE_AR } from "@/lib/labels";
import type { Pt } from "@/components/viewer/ImageViewer";

export interface FindingDTO {
  id: string;
  lobe: keyof typeof LOBE_AR;
  zone: keyof typeof ZONE_AR;
  nearCapsule: boolean;
  lengthMm: number;
  widthMm: number;
  depthMm: number;
  volumeMl: number;
  composition: keyof typeof FEATURE_AR.composition;
  echogenicity: keyof typeof FEATURE_AR.echogenicity;
  shape: keyof typeof FEATURE_AR.shape;
  margin: keyof typeof FEATURE_AR.margin;
  echogenicFoci: (keyof typeof FEATURE_AR.echogenicFoci)[];
  tiradsPoints: number;
  tiradsLevel: number;
  risk: keyof typeof RISK_META;
  confidence: number;
  explanation: { feature: string; value: string; points: number; reason?: string; valueAr?: string }[];
}

type Decision = keyof typeof DECISION_AR;
type Rec = keyof typeof RECOMMENDATION_AR;

const ACTION_TO_REC: Record<string, Rec> = { FNA: "FNA", US_FOLLOW_UP: "US_FOLLOW_UP", NO_ACTION: "ROUTINE_FOLLOW_UP" };

/** AI result and Doctor Final Review side by side. Final TI-RADS recomputes live (and again on the server). */
export function ReviewPanel(props: {
  analysisId: string;
  finding: FindingDTO | null;
  contourEdited: boolean;
  editedContour: Pt[] | null;
  onResetContour: () => void;
}) {
  const { finding: f } = props;
  const router = useRouter();
  const [decision, setDecision] = useState<Decision>("CONFIRMED");
  const [feat, setFeat] = useState(() =>
    f ? { composition: f.composition, echogenicity: f.echogenicity, shape: f.shape, margin: f.margin, echogenicFoci: f.echogenicFoci } : null,
  );
  const [dims, setDims] = useState(() => (f ? { lengthMm: f.lengthMm, widthMm: f.widthMm, depthMm: f.depthMm } : null));
  const [rec, setRec] = useState<Rec>(() => (f ? ACTION_TO_REC[suggestAction(f.tiradsLevel, Math.max(f.lengthMm, f.widthMm, f.depthMm))] : "ADDITIONAL_IMAGING"));
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changedFeatures = useMemo(() => {
    if (!f || !feat) return [] as string[];
    const keys = ["composition", "echogenicity", "shape", "margin"] as const;
    const c: string[] = keys.filter((k) => feat[k] !== f[k]);
    if ([...feat.echogenicFoci].sort().join() !== [...f.echogenicFoci].sort().join()) c.push("echogenicFoci");
    if (dims && (dims.lengthMm !== f.lengthMm || dims.widthMm !== f.widthMm || dims.depthMm !== f.depthMm)) c.push("dimensions");
    if (props.contourEdited) c.push("contour");
    return c;
  }, [f, feat, dims, props.contourEdited]);

  // Any edit switches the decision to MODIFIED automatically (keeps the record honest)
  const effectiveDecision: Decision = decision === "REJECTED" ? "REJECTED" : changedFeatures.length ? "MODIFIED" : "CONFIRMED";
  const final = feat ? scoreTirads(feat) : null;
  const finalRisk = final ? RISK_META[riskFromLevel(final.level)] : null;
  const maxDim = dims ? Math.max(dims.lengthMm, dims.widthMm, dims.depthMm) : 0;

  async function sign() {
    setBusy(true);
    setError(null);
    const body = {
      decision: effectiveDecision,
      findingId: f?.id,
      recommendation: rec,
      clinicalNotes: notes || undefined,
      changeReason: reason || undefined,
      ...(effectiveDecision === "MODIFIED" && feat ? { features: feat, dimensions: dims ?? undefined, contour: props.editedContour ?? undefined } : {}),
    };
    const res = await fetch(`/api/analysis/${props.analysisId}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setConfirming(false);
    if (!res.ok) return setError(json.error ?? "تعذّر حفظ المراجعة");
    router.refresh();
  }

  const needsReason = effectiveDecision !== "CONFIRMED";

  return (
    <section className="rounded-2xl border border-navy-100 bg-white" aria-labelledby="review-title">
      <header className="flex items-center justify-between gap-3 border-b border-navy-50 px-5 py-4">
        <h2 id="review-title" className="text-lg font-bold text-navy-800">مراجعة الطبيب النهائية</h2>
        <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", effectiveDecision === "CONFIRMED" ? "bg-green-100 text-green-800" : effectiveDecision === "MODIFIED" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700")}>
          {DECISION_AR[effectiveDecision]}
        </span>
      </header>

      {f && feat && dims ? (
        <>
          <p className="px-5 pt-4 text-sm text-ink-soft">
            العقدة في <b className="text-navy-800">{LOBE_AR[f.lobe]}، {ZONE_AR[f.zone]}</b>
            {f.nearCapsule ? "، قريبة من غلاف الغدة" : ""}. ثقة النظام <b dir="ltr">{Math.round(f.confidence * 100)}%</b>.
          </p>

          {/* Side-by-side: AI vs final */}
          <div className="overflow-x-auto px-5 pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-muted">
                  <th className="pb-2 text-start font-medium">الخاصية</th>
                  <th className="pb-2 text-start font-medium"><span className="inline-flex items-center gap-1"><Bot className="h-4 w-4" /> نتيجة AI</span></th>
                  <th className="pb-2 text-start font-medium"><span className="inline-flex items-center gap-1"><Stethoscope className="h-4 w-4" /> قرار الطبيب</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {(["composition", "echogenicity", "shape", "margin"] as const).map((k) => {
                  const ex = f.explanation.find((e) => e.feature === k);
                  const opts = FEATURE_AR[k] as Record<string, string>;
                  return (
                    <tr key={k} className={clsx(changedFeatures.includes(k) && "bg-amber-50")}>
                      <td className="py-2.5 font-medium text-navy-800">{FEATURE_NAME_AR[k]}</td>
                      <td className="py-2.5 pe-3">
                        <p className="text-navy-800">{opts[f[k]]} <span className="text-ink-muted">({ex?.points ?? 0})</span></p>
                        {ex?.reason && <p className="text-xs text-ink-muted" dir="ltr">{ex.reason}</p>}
                      </td>
                      <td className="py-2.5">
                        <select
                          aria-label={`القرار النهائي: ${FEATURE_NAME_AR[k]}`}
                          disabled={decision === "REJECTED"}
                          value={feat[k]}
                          onChange={(e) => setFeat({ ...feat, [k]: e.target.value } as typeof feat)}
                          className="input py-1.5 text-sm"
                        >
                          {Object.entries(opts).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
                <tr className={clsx(changedFeatures.includes("echogenicFoci") && "bg-amber-50")}>
                  <td className="py-2.5 font-medium text-navy-800">{FEATURE_NAME_AR.echogenicFoci}</td>
                  <td className="py-2.5 pe-3 text-navy-800">{f.echogenicFoci.map((x) => FEATURE_AR.echogenicFoci[x]).join("، ")}</td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(Object.keys(FEATURE_AR.echogenicFoci) as (keyof typeof FEATURE_AR.echogenicFoci)[]).map((x) => {
                        const on = feat.echogenicFoci.includes(x);
                        return (
                          <button
                            key={x}
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            disabled={decision === "REJECTED"}
                            onClick={() => {
                              let next = x === "NONE" ? ["NONE" as const] : on ? feat.echogenicFoci.filter((y) => y !== x) : [...feat.echogenicFoci.filter((y) => y !== "NONE"), x];
                              if (!next.length) next = ["NONE"];
                              setFeat({ ...feat, echogenicFoci: next });
                            }}
                            className={clsx("rounded-full border px-2 py-0.5 text-xs", on ? "border-navy-800 bg-navy-800 text-white" : "border-navy-100 text-navy-700")}
                          >
                            {FEATURE_AR.echogenicFoci[x]}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
                <tr className={clsx(changedFeatures.includes("dimensions") && "bg-amber-50")}>
                  <td className="py-2.5 font-medium text-navy-800">الأبعاد (mm)</td>
                  <td className="py-2.5 pe-3 text-navy-800" dir="ltr">{f.lengthMm} × {f.widthMm} × {f.depthMm}</td>
                  <td className="py-2.5">
                    <div className="flex gap-1" dir="ltr">
                      {(["lengthMm", "widthMm", "depthMm"] as const).map((k) => (
                        <input
                          key={k}
                          type="number"
                          step="0.1"
                          min="0.1"
                          disabled={decision === "REJECTED"}
                          aria-label={{ lengthMm: "الطول", widthMm: "العرض", depthMm: "العمق" }[k]}
                          value={dims[k]}
                          onChange={(e) => setDims({ ...dims, [k]: Math.max(0.1, Number(e.target.value) || 0.1) })}
                          className="input w-16 px-2 py-1.5 text-sm"
                        />
                      ))}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 font-bold text-navy-800">ACR TI-RADS</td>
                  <td className="py-3 pe-3">
                    <TiradsChip level={f.tiradsLevel} points={f.tiradsPoints} />
                  </td>
                  <td className="py-3">{decision === "REJECTED" ? <span className="text-sm text-red-600">مرفوض</span> : final && <TiradsChip level={final.level} points={final.points} />}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {props.contourEdited && (
            <p className="mx-5 mt-2 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              تم تعديل حدود العقدة يدويًا على الصورة.
              <button onClick={props.onResetContour} className="flex items-center gap-1 font-semibold"><Undo2 className="h-3.5 w-3.5" /> استرجاع حدود AI</button>
            </p>
          )}
          {finalRisk && decision !== "REJECTED" && (
            <p className="mx-5 mt-3 text-sm text-ink-soft">
              الحجم <span dir="ltr">{ellipsoidVolumeMl(dims.lengthMm, dims.widthMm, dims.depthMm)} ml</span>، والتوصية حسب ACR لأكبر بُعد <span dir="ltr">{maxDim} mm</span>:{" "}
              <b className="text-navy-800">{RECOMMENDATION_AR[ACTION_TO_REC[suggestAction(final!.level, maxDim)]]}</b>
            </p>
          )}
        </>
      ) : (
        <p className="mx-5 mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">لم يحدد النظام أي عقدة في هذه الصور. يمكنك رفض النتيجة وطلب إشاعة إضافية.</p>
      )}

      {/* Decision form */}
      <div className="space-y-4 p-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-navy-800">القرار</legend>
          <div className="flex flex-wrap gap-2">
            <Radio on={decision !== "REJECTED"} onClick={() => setDecision("CONFIRMED")} label={changedFeatures.length ? "اعتماد مع التعديلات" : "تأكيد نتيجة AI"} disabled={!f} />
            <Radio on={decision === "REJECTED"} onClick={() => setDecision("REJECTED")} label="رفض النتيجة" danger />
          </div>
        </fieldset>
        <label className="block text-sm font-semibold text-navy-800">
          التوصية
          <select value={rec} onChange={(e) => setRec(e.target.value as Rec)} className="input mt-1">
            {Object.entries(RECOMMENDATION_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold text-navy-800">
          ملاحظات سريرية
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} className="input mt-1 resize-y font-normal" placeholder="تظهر في التقرير النهائي" />
        </label>
        {needsReason && (
          <label className="block text-sm font-semibold text-navy-800">
            سبب {effectiveDecision === "REJECTED" ? "الرفض" : "التعديل"} <span className="text-red-600">*</span>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} className="input mt-1 resize-y font-normal" placeholder="يُحفظ في سجل التدقيق" aria-required />
          </label>
        )}
        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button onClick={() => setConfirming(true)} disabled={needsReason && reason.trim().length < 5} className="btn-primary w-full py-3 disabled:opacity-50">
          <ShieldCheck className="h-5 w-5" /> اعتماد وتوقيع التقرير
        </button>
        <p className="text-xs leading-5 text-ink-muted">بعد التوقيع لا يمكن تعديل التقرير. تُحفظ نتيجة AI الأصلية وقرارك معًا مع بصمة رقمية.</p>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card">
            <h3 id="confirm-title" className="flex items-center gap-2 text-lg font-bold text-navy-800">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> تأكيد الاعتماد
            </h3>
            <ul className="mt-3 space-y-1 text-sm text-ink-soft">
              <li>القرار: <b className="text-navy-800">{DECISION_AR[effectiveDecision]}</b></li>
              {final && decision !== "REJECTED" && <li>التصنيف النهائي: <b className="text-navy-800" dir="ltr">TR{final.level}</b></li>}
              <li>التوصية: <b className="text-navy-800">{RECOMMENDATION_AR[rec]}</b></li>
            </ul>
            <p className="mt-3 text-sm text-ink-soft">سيُوقَّع التقرير باسمك ولن يمكن تعديله بعد ذلك.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={sign} disabled={busy} className="btn-primary flex-1" autoFocus>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} وقّع واعتمد
              </button>
              <button onClick={() => setConfirming(false)} disabled={busy} className="btn-outline flex-1">رجوع</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function TiradsChip({ level, points }: { level: number; points: number }) {
  const r = RISK_META[riskFromLevel(level)];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", r.bg, r.color)}>
      <span dir="ltr">TR{level}</span>
      <span className="font-medium">({points} نقاط)</span>
    </span>
  );
}

function Radio({ on, onClick, label, danger, disabled }: { on: boolean; onClick: () => void; label: string; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "rounded-lg border px-3.5 py-2 text-sm font-semibold disabled:opacity-40",
        on ? (danger ? "border-red-600 bg-red-600 text-white" : "border-navy-800 bg-navy-800 text-white") : "border-navy-100 text-navy-700 hover:border-brand-400",
      )}
    >
      {label}
    </button>
  );
}
