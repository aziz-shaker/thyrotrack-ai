"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Hand, Ruler, Square, PenLine, ZoomIn, ZoomOut, RotateCcw, Eye, EyeOff, Sun, Contrast, Trash2 } from "lucide-react";

export interface ViewerImage {
  id: string;
  view: "TRANSVERSE" | "SAGITTAL" | "UNKNOWN";
  width: number | null;
  height: number | null;
  pixelSpacingMm: number | null;
}

export type Pt = [number, number]; // normalized 0..1 image coords

export interface Overlay {
  imageId: string;
  contour: Pt[];
  bbox?: { x: number; y: number; w: number; h: number };
  label: string;
  color: string;
}

type Tool = "pan" | "measure" | "roi" | "edit";
type Line = { a: Pt; b: Pt };

const VIEW_AR = { TRANSVERSE: "مقطع عرضي", SAGITTAL: "مقطع طولي", UNKNOWN: "مقطع غير محدد" };

/**
 * Ultrasound viewer: zoom / pan / window (brightness-contrast) / caliper / ROI / AI overlay /
 * manual contour editing. Coordinates are kept normalized so they're resolution-independent.
 */
export function ImageViewer(props: {
  images: ViewerImage[];
  overlays: Overlay[];
  editableImageId?: string;
  editedContour?: Pt[] | null;
  onContourChange?: (c: Pt[]) => void;
}) {
  const { images, overlays } = props;
  const [active, setActive] = useState(0);
  const [tool, setTool] = useState<Tool>("pan");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [showOverlay, setShowOverlay] = useState(true);
  const [lines, setLines] = useState<Record<string, Line[]>>({});
  const [roi, setRoi] = useState<Record<string, Line | null>>({});
  const [draft, setDraft] = useState<Line | null>(null);
  const [dragVertex, setDragVertex] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const img = images[active];
  const aspect = img?.width && img?.height ? img.width / img.height : 4 / 3;
  const editable = !!img && img.id === props.editableImageId && !!props.onContourChange;
  const contour = editable && props.editedContour ? props.editedContour : null;

  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setBrightness(100);
    setContrast(100);
  };

  // Client → normalized image coordinates (works under CSS transforms)
  const toImg = useCallback((e: { clientX: number; clientY: number }): Pt => {
    const r = stageRef.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  }, []);

  const mm = (l: Line) => {
    const s = img?.pixelSpacingMm;
    if (!s || !img?.width || !img?.height) return null;
    return Math.hypot((l.b[0] - l.a[0]) * img.width * s, (l.b[1] - l.a[1]) * img.height * s);
  };

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (tool === "pan") panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    if (tool === "measure" || tool === "roi") {
      const p = toImg(e);
      setDraft({ a: p, b: p });
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (tool === "pan" && panStart.current) {
      setPan({ x: panStart.current.px + (e.clientX - panStart.current.x), y: panStart.current.py + (e.clientY - panStart.current.y) });
    }
    if (draft) setDraft({ a: draft.a, b: toImg(e) });
    if (tool === "edit" && dragVertex !== null && contour) {
      const next = contour.slice();
      next[dragVertex] = toImg(e);
      props.onContourChange!(next);
    }
  }
  function onPointerUp() {
    panStart.current = null;
    setDragVertex(null);
    if (draft && img) {
      const tiny = Math.hypot(draft.b[0] - draft.a[0], draft.b[1] - draft.a[1]) < 0.01;
      if (!tiny) {
        if (tool === "measure") setLines((s) => ({ ...s, [img.id]: [...(s[img.id] ?? []), draft] }));
        if (tool === "roi") setRoi((s) => ({ ...s, [img.id]: draft }));
      }
      setDraft(null);
    }
  }
  function onWheel(e: React.WheelEvent) {
    setZoom((z) => Math.min(6, Math.max(1, z * (e.deltaY < 0 ? 1.1 : 0.9))));
  }

  // Keyboard shortcuts on the stage
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(6, z * 1.2));
    else if (e.key === "-") setZoom((z) => Math.max(1, z / 1.2));
    else if (e.key === "0") reset();
    else if (e.key === "ArrowLeft") setPan((p) => ({ ...p, x: p.x + 20 }));
    else if (e.key === "ArrowRight") setPan((p) => ({ ...p, x: p.x - 20 }));
    else if (e.key === "ArrowUp") setPan((p) => ({ ...p, y: p.y + 20 }));
    else if (e.key === "ArrowDown") setPan((p) => ({ ...p, y: p.y - 20 }));
    else return;
    e.preventDefault();
  }

  useEffect(() => setDraft(null), [active, tool]);

  // Fit the image exactly into the viewport so the overlay (normalized coords) stays aligned
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const fit = () => {
      const cw = el.clientWidth, ch = el.clientHeight;
      const w = Math.min(cw, ch * aspect);
      setBox({ w, h: w / aspect });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  if (!img) return <div className="grid h-80 place-items-center rounded-2xl bg-navy-900 text-white/60">لا توجد صور في هذا الفحص</div>;

  const imgOverlays = overlays.filter((o) => o.imageId === img.id);
  const curLines = lines[img.id] ?? [];
  const curRoi = roi[img.id];
  const roiDims = curRoi && img.pixelSpacingMm && img.width && img.height
    ? { w: Math.abs(curRoi.b[0] - curRoi.a[0]) * img.width * img.pixelSpacingMm, h: Math.abs(curRoi.b[1] - curRoi.a[1]) * img.height * img.pixelSpacingMm }
    : null;

  const tools: { id: Tool; label: string; icon: typeof Hand; show: boolean }[] = [
    { id: "pan", label: "تحريك", icon: Hand, show: true },
    { id: "measure", label: "قياس", icon: Ruler, show: true },
    { id: "roi", label: "تحديد منطقة (ROI)", icon: Square, show: true },
    { id: "edit", label: "تعديل حدود العقدة", icon: PenLine, show: editable },
  ];

  return (
    <div className="overflow-hidden rounded-2xl bg-navy-900 text-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 p-2" role="toolbar" aria-label="أدوات العارض">
        {tools.filter((t) => t.show).map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            aria-pressed={tool === t.id}
            title={t.label}
            className={clsx("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm", tool === t.id ? "bg-brand-500 text-white" : "text-white/75 hover:bg-white/10")}
          >
            <t.icon className="h-4 w-4" /> <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-white/15" />
        <IconBtn label="تكبير" onClick={() => setZoom((z) => Math.min(6, z * 1.25))}><ZoomIn className="h-4 w-4" /></IconBtn>
        <IconBtn label="تصغير" onClick={() => setZoom((z) => Math.max(1, z / 1.25))}><ZoomOut className="h-4 w-4" /></IconBtn>
        <IconBtn label={showOverlay ? "إخفاء تحديد AI" : "إظهار تحديد AI"} onClick={() => setShowOverlay((v) => !v)}>
          {showOverlay ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </IconBtn>
        <IconBtn label="مسح القياسات" onClick={() => { setLines((s) => ({ ...s, [img.id]: [] })); setRoi((s) => ({ ...s, [img.id]: null })); }}>
          <Trash2 className="h-4 w-4" />
        </IconBtn>
        <IconBtn label="إعادة الضبط" onClick={reset}><RotateCcw className="h-4 w-4" /></IconBtn>
        <span className="ms-auto text-xs text-white/60" dir="ltr">{Math.round(zoom * 100)}%</span>
      </div>

      {/* Stage */}
      <div
        ref={viewportRef}
        className={clsx("relative flex h-[440px] items-center justify-center overflow-hidden bg-black outline-none sm:h-[520px]", tool === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair")}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        tabIndex={0}
        aria-label="الصورة. استخدم + و - للتكبير والأسهم للتحريك و 0 لإعادة الضبط"
      >
        <div
          className="relative shrink-0"
          style={{ width: box.w, height: box.h, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center" }}
        >
          <div
            ref={stageRef}
            className="absolute inset-0 touch-none select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/images/${img.id}`}
              alt={`إشاعة سونار، ${VIEW_AR[img.view]}`}
              draggable={false}
              className="h-full w-full"
              style={{ filter: `brightness(${brightness}%) contrast(${contrast}%)` }}
            />
            <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
              {showOverlay &&
                imgOverlays.map((o, i) => (
                  <g key={i}>
                    {o.bbox && (
                      <rect x={o.bbox.x} y={o.bbox.y} width={o.bbox.w} height={o.bbox.h} fill="none" stroke="#F97316" strokeWidth={1.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
                    )}
                    <polygon points={o.contour.map((p) => p.join(",")).join(" ")} fill={`${o.color}33`} stroke={o.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  </g>
                ))}
              {contour && (
                <polygon points={contour.map((p) => p.join(",")).join(" ")} fill="#facc1526" stroke="#facc15" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              )}
              {[...curLines, ...(draft && tool === "measure" ? [draft] : [])].map((l, i) => (
                <line key={i} x1={l.a[0]} y1={l.a[1]} x2={l.b[0]} y2={l.b[1]} stroke="#facc15" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              ))}
              {[curRoi, draft && tool === "roi" ? draft : null].filter(Boolean).map((r, i) => (
                <rect key={i} x={Math.min(r!.a[0], r!.b[0])} y={Math.min(r!.a[1], r!.b[1])} width={Math.abs(r!.b[0] - r!.a[0])} height={Math.abs(r!.b[1] - r!.a[1])} fill="#38bdf81a" stroke="#38bdf8" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              ))}
            </svg>

            {/* Draggable vertices for manual boundary editing */}
            {tool === "edit" && contour?.map((p, i) => (
              <button
                key={i}
                aria-label={`نقطة حدود ${i + 1}`}
                onPointerDown={(e) => { e.stopPropagation(); (e.target as Element).setPointerCapture(e.pointerId); setDragVertex(i); }}
                className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-navy-900 bg-yellow-300"
                style={{ left: `${p[0] * 100}%`, top: `${p[1] * 100}%`, transform: `translate(-50%,-50%) scale(${1 / zoom})` }}
              />
            ))}

            {/* HTML labels (SVG text would stretch with preserveAspectRatio=none) */}
            {showOverlay && imgOverlays.map((o, i) => o.bbox && (
              <span key={i} className="pointer-events-none absolute whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold" style={{ left: `${o.bbox.x * 100}%`, top: `${o.bbox.y * 100}%`, transform: `translateY(-110%) scale(${1 / zoom})`, transformOrigin: "bottom left", color: o.color }}>
                {o.label}
              </span>
            ))}
            {curLines.map((l, i) => {
              const d = mm(l);
              return (
                <span key={i} dir="ltr" className="pointer-events-none absolute rounded bg-black/70 px-1 text-[11px] font-semibold text-yellow-300" style={{ left: `${((l.a[0] + l.b[0]) / 2) * 100}%`, top: `${((l.a[1] + l.b[1]) / 2) * 100}%`, transform: `translate(-50%,-130%) scale(${1 / zoom})` }}>
                  {d ? `${d.toFixed(1)} mm` : "بدون معايرة"}
                </span>
              );
            })}
          </div>
        </div>

        <span className="pointer-events-none absolute start-3 top-3 rounded bg-black/60 px-2 py-1 text-xs text-white/80">{VIEW_AR[img.view]}</span>
        {roiDims && (
          <span dir="ltr" className="pointer-events-none absolute bottom-3 end-3 rounded bg-black/60 px-2 py-1 text-xs text-sky-300">
            ROI {roiDims.w.toFixed(1)} × {roiDims.h.toFixed(1)} mm
          </span>
        )}
        {!img.pixelSpacingMm && (
          <span className="pointer-events-none absolute bottom-3 start-3 rounded bg-amber-500/90 px-2 py-1 text-xs font-semibold text-navy-900">الصورة بدون معايرة: القياسات تقريبية</span>
        )}
      </div>

      {/* Window controls + thumbnails */}
      <div className="grid gap-3 border-t border-white/10 p-3 sm:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-2 gap-4 text-xs text-white/70">
          <Slider icon={Sun} label="السطوع" value={brightness} onChange={setBrightness} />
          <Slider icon={Contrast} label="التباين" value={contrast} onChange={setContrast} />
        </div>
        {images.length > 1 && (
          <div className="flex gap-2">
            {images.map((im, i) => (
              <button key={im.id} onClick={() => setActive(i)} aria-pressed={i === active} aria-label={VIEW_AR[im.view]} className={clsx("relative h-14 w-20 overflow-hidden rounded-md border-2", i === active ? "border-brand-400" : "border-transparent opacity-60 hover:opacity-100")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/images/${im.id}`} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[10px]">{im.view === "TRANSVERSE" ? "عرضي" : im.view === "SAGITTAL" ? "طولي" : "؟"}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="rounded-md p-2 text-white/75 hover:bg-white/10">
      {children}
    </button>
  );
}

function Slider({ icon: Icon, label, value, onChange }: { icon: typeof Sun; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only">{label}</span>
      <input type="range" min={40} max={200} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-brand-400" aria-label={label} />
      <span className="w-9 text-end" dir="ltr">{value}%</span>
    </label>
  );
}
