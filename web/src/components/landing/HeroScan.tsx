/**
 * Hero visual: the thyroid drawn as horizontal "scan line" pills (the brand's line motif),
 * with one sweep on load that fills the gland and then traces the detected nodule.
 * Pure SVG + CSS; the animation is disabled under prefers-reduced-motion.
 */

const W = 520;
const ROWS = 11;
const ROW_H = 22;
const GAP = 14;
const TOP = 34;
const LOBE_R = { cx: 168, hw: 92 }; // viewer-left = patient's RIGHT lobe (transverse convention)
const LOBE_L = { cx: 352, hw: 92 };
const ISTHMUS_ROWS = new Set([6, 7]);

type Pill = { x: number; y: number; w: number };

function lobeHalfWidth(i: number) {
  // Lobes are tall, slightly bottom-heavy ellipses
  const t = (i - 5.6) / 6.1;
  return Math.max(0, LOBE_R.hw * Math.sqrt(Math.max(0, 1 - t * t)));
}

function buildPills(): Pill[] {
  const pills: Pill[] = [];
  for (let i = 0; i < ROWS; i++) {
    const hw = lobeHalfWidth(i);
    if (hw < 18) continue;
    const y = TOP + i * (ROW_H + GAP);
    if (ISTHMUS_ROWS.has(i)) {
      pills.push({ x: LOBE_R.cx - hw, y, w: LOBE_L.cx + hw - (LOBE_R.cx - hw) });
    } else {
      pills.push({ x: LOBE_R.cx - hw, y, w: hw * 2 });
      pills.push({ x: LOBE_L.cx - hw, y, w: hw * 2 });
    }
  }
  return pills;
}

const PILLS = buildPills();
const H = TOP * 2 + ROWS * (ROW_H + GAP);

// Nodule in the right lobe, middle third
const NODULE = { cx: 150, cy: TOP + 4.6 * (ROW_H + GAP), rx: 40, ry: 33 };
const SWEEP_MS = 2200;

export function HeroScan() {
  return (
    <figure className="hero-scan relative mx-auto w-full max-w-[560px]" aria-label="رسم توضيحي للغدة الدرقية مع عقدة محددة في الفص الأيمن">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
        <defs>
          <linearGradient id="sweep" x1="0" x2="1">
            <stop offset="0" stopColor="#0E9FDC" stopOpacity="0" />
            <stop offset="0.5" stopColor="#0E9FDC" stopOpacity="0.55" />
            <stop offset="1" stopColor="#0E9FDC" stopOpacity="0" />
          </linearGradient>
          <clipPath id="gland">
            {PILLS.map((p, i) => (
              <rect key={i} x={p.x} y={p.y} width={p.w} height={ROW_H} rx={ROW_H / 2} />
            ))}
          </clipPath>
        </defs>

        {/* Gland: pills fill as the sweep passes (delay ∝ x position) */}
        {PILLS.map((p, i) => (
          <rect
            key={i}
            className="scan-pill"
            style={{ animationDelay: `${Math.round((p.x / W) * SWEEP_MS * 0.8)}ms` }}
            x={p.x}
            y={p.y}
            width={p.w}
            height={ROW_H}
            rx={ROW_H / 2}
          />
        ))}

        {/* Nodule: tinted where it intersects the gland lines, then the contour draws */}
        <g clipPath="url(#gland)">
          <ellipse className="scan-nodule-fill" cx={NODULE.cx} cy={NODULE.cy} rx={NODULE.rx} ry={NODULE.ry} />
        </g>
        <ellipse
          className="scan-nodule-line"
          cx={NODULE.cx}
          cy={NODULE.cy}
          rx={NODULE.rx + 6}
          ry={NODULE.ry + 6}
          pathLength={1}
        />

        {/* The single sweep */}
        <rect className="scan-sweep" x={-40} y={0} width={40} height={H} fill="url(#sweep)" />

        {/* Anatomical side labels (radiology convention) */}
        <text x={LOBE_R.cx} y={H - 4} textAnchor="middle" className="fill-navy-700 text-[15px] font-medium">الفص الأيمن</text>
        <text x={LOBE_L.cx} y={H - 4} textAnchor="middle" className="fill-navy-700 text-[15px] font-medium">الفص الأيسر</text>
      </svg>

      {/* Finding card, anchored near the nodule */}
      <figcaption className="scan-card absolute -top-4 end-0 w-56 rounded-xl bg-white p-4 shadow-card sm:end-[-6%]">
        <p className="text-sm text-ink-soft">عقدة في الثلث الأوسط</p>
        <p className="mt-1 text-lg font-semibold text-navy-800">
          <span dir="ltr">TR4</span>، خطورة متوسطة
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          <span dir="ltr">18 × 14 × 12 mm</span>
        </p>
        <p className="mt-3 border-t border-navy-50 pt-2 text-xs text-ink-muted">نتيجة مقترحة بانتظار مراجعة الطبيب</p>
      </figcaption>
    </figure>
  );
}
