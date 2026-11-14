"use client";

import { useMemo, useState } from "react";
import type { Composition, Echogenicity, Shape, Margin, EchogenicFoci } from "@prisma/client";
import { scoreTirads, suggestAction, riskFromLevel, ellipsoidVolumeMl, RISK_META, POINTS } from "@/lib/tirads";

const LABELS = {
  composition: { CYSTIC: "كيسية", SPONGIFORM: "إسفنجية", MIXED: "مختلطة (كيسية/صلبة)", SOLID: "صلبة أو شبه صلبة" },
  echogenicity: { ANECHOIC: "عديمة الصدى", HYPERECHOIC: "عالية الصدى", ISOECHOIC: "متساوية الصدى", HYPOECHOIC: "منخفضة الصدى", VERY_HYPOECHOIC: "منخفضة الصدى جدًا" },
  shape: { WIDER_THAN_TALL: "أعرض من طولها", TALLER_THAN_WIDE: "أطول من عرضها" },
  margin: { SMOOTH: "ناعمة", ILL_DEFINED: "غير محددة", LOBULATED: "مفصّصة / غير منتظمة", EXTRATHYROIDAL: "امتداد خارج الغدة" },
  foci: { NONE: "لا يوجد", COMET_TAIL: "ذيل المذنب", MACRO: "تكلسات كبيرة", RIM: "تكلس طرفي", PUNCTATE: "بؤر نقطية" },
} as const;

const ACTION_AR = {
  FNA: "يُنصح بمناقشة سحب عينة (FNA) مع الطبيب",
  US_FOLLOW_UP: "يُنصح بمتابعة بالسونار",
  NO_ACTION: "لا حاجة لـ FNA أو متابعة حسب الحجم الحالي",
};

export function TiradsCalculator() {
  const [composition, setComposition] = useState<Composition>("SOLID");
  const [echogenicity, setEchogenicity] = useState<Echogenicity>("HYPOECHOIC");
  const [shape, setShape] = useState<Shape>("WIDER_THAN_TALL");
  const [margin, setMargin] = useState<Margin>("SMOOTH");
  const [foci, setFoci] = useState<EchogenicFoci[]>(["NONE"]);
  const [dims, setDims] = useState({ l: 15, w: 11, d: 10 });

  const r = useMemo(() => scoreTirads({ composition, echogenicity, shape, margin, echogenicFoci: foci }), [composition, echogenicity, shape, margin, foci]);
  const maxDim = Math.max(dims.l, dims.w, dims.d);
  const action = suggestAction(r.level, maxDim);
  const risk = RISK_META[riskFromLevel(r.level)];
  const volume = ellipsoidVolumeMl(dims.l, dims.w, dims.d);

  const toggleFocus = (f: EchogenicFoci) =>
    setFoci((cur) => {
      if (f === "NONE") return ["NONE"];
      const next = cur.includes(f) ? cur.filter((x) => x !== f) : [...cur.filter((x) => x !== "NONE"), f];
      return next.length ? next : ["NONE"];
    });

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6 rounded-2xl border border-navy-100 bg-white p-6">
        <Group title="التركيب (Composition)">
          {(Object.keys(LABELS.composition) as Composition[]).map((k) => (
            <Choice key={k} on={composition === k} onClick={() => setComposition(k)} label={LABELS.composition[k]} pts={POINTS.composition[k]} />
          ))}
        </Group>
        <Group title="الصدى (Echogenicity)">
          {(Object.keys(LABELS.echogenicity) as Echogenicity[]).map((k) => (
            <Choice key={k} on={echogenicity === k} onClick={() => setEchogenicity(k)} label={LABELS.echogenicity[k]} pts={POINTS.echogenicity[k]} />
          ))}
        </Group>
        <Group title="الشكل (Shape)">
          {(Object.keys(LABELS.shape) as Shape[]).map((k) => (
            <Choice key={k} on={shape === k} onClick={() => setShape(k)} label={LABELS.shape[k]} pts={POINTS.shape[k]} />
          ))}
        </Group>
        <Group title="الحواف (Margin)">
          {(Object.keys(LABELS.margin) as Margin[]).map((k) => (
            <Choice key={k} on={margin === k} onClick={() => setMargin(k)} label={LABELS.margin[k]} pts={POINTS.margin[k]} />
          ))}
        </Group>
        <Group title="البؤر الصدوية (اختر كل ما ينطبق)">
          {(Object.keys(LABELS.foci) as EchogenicFoci[]).map((k) => (
            <Choice key={k} on={foci.includes(k)} onClick={() => toggleFocus(k)} label={LABELS.foci[k]} pts={POINTS.foci[k]} multi />
          ))}
        </Group>
        <Group title="الأبعاد (mm)">
          {(["l", "w", "d"] as const).map((k) => (
            <label key={k} className="text-sm text-navy-700">
              {{ l: "الطول", w: "العرض", d: "العمق" }[k]}
              <input type="number" min={1} max={120} value={dims[k]} onChange={(e) => setDims({ ...dims, [k]: Math.max(1, Number(e.target.value) || 1) })} className="input mt-1 w-24" dir="ltr" />
            </label>
          ))}
        </Group>
      </div>

      {/* Result */}
      <aside className="h-fit rounded-2xl bg-navy-800 p-6 text-white lg:sticky lg:top-28" aria-live="polite">
        <p className="text-sm text-white/70">النتيجة</p>
        <p className="mt-1 text-5xl font-extrabold" dir="ltr">TR{r.level}</p>
        <span className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-bold ${risk.bg} ${risk.color}`}>{risk.ar}</span>
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-white/15 pt-5 text-sm">
          <div><dt className="text-white/60">مجموع النقاط</dt><dd className="text-2xl font-extrabold text-brand-300">{r.points}</dd></div>
          <div><dt className="text-white/60">الحجم التقريبي</dt><dd className="text-2xl font-extrabold text-brand-300" dir="ltr">{volume} ml</dd></div>
        </dl>
        <p className="mt-5 rounded-lg bg-white/10 p-3 text-sm leading-6">{ACTION_AR[action]} <span className="text-white/60">(أكبر بُعد {maxDim} mm)</span></p>
        <ul className="mt-5 space-y-1 text-xs text-white/70">
          {r.breakdown.filter((b) => b.points > 0).map((b, i) => (
            <li key={i} className="flex justify-between"><span dir="ltr">{b.feature}: {b.value}</span><span>+{b.points}</span></li>
          ))}
        </ul>
        <p className="mt-6 text-xs leading-5 text-white/60">أداة تعليمية مبنية على ACR TI-RADS 2017. لا تُغني عن تقييم الطبيب ولا تمثل تشخيصًا.</p>
      </aside>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 font-extrabold text-navy-800">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Choice({ on, onClick, label, pts, multi }: { on: boolean; onClick: () => void; label: string; pts: number; multi?: boolean }) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={on}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${on ? "border-navy-800 bg-navy-800 text-white" : "border-navy-100 text-navy-700 hover:border-brand-400"}`}
    >
      {label} <span className={on ? "text-brand-300" : "text-ink-muted"}>({pts})</span>
    </button>
  );
}
