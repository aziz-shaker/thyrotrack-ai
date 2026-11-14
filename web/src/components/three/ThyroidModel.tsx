"use client";

import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import type { Model3DNodule } from "@/lib/services/model3d";

const RISK_COLOR = { BENIGN: "#22C55E", LOW: "#22C55E", MODERATE: "#EAB308", HIGH: "#F97316", SUSPICIOUS: "#EF4444" } as const;
const RISK_AR = { BENIGN: "حميدة", LOW: "خطورة منخفضة", MODERATE: "خطورة متوسطة", HIGH: "خطورة عالية", SUSPICIOUS: "مشتبه بها" } as const;
const LOBE_AR = { RIGHT: "الفص الأيمن", LEFT: "الفص الأيسر", ISTHMUS: "البرزخ" } as const;
const ZONE_AR = { UPPER: "الجزء العلوي", MIDDLE: "الجزء الأوسط", LOWER: "الجزء السفلي" } as const;

/**
 * Anterior view (facing the patient): the patient's RIGHT lobe appears on the viewer's LEFT.
 * Units are arbitrary scene units; a lobe is ~2.4 tall.
 */
function nodulePosition(lobe: keyof typeof LOBE_AR, zone: keyof typeof ZONE_AR): [number, number, number] {
  const x = lobe === "RIGHT" ? -1.05 : lobe === "LEFT" ? 1.05 : 0;
  const y = lobe === "ISTHMUS" ? -0.45 : zone === "UPPER" ? 0.7 : zone === "LOWER" ? -0.7 : 0;
  return [x, y, 0.42];
}

// Volume (ml) → sphere radius in scene units, clamped so tiny and huge nodules stay readable
const radiusFor = (ml: number) => Math.min(0.5, Math.max(0.12, Math.cbrt(ml) * 0.17));

function Gland({ detailed }: { detailed: boolean }) {
  const tissue = { color: "#E8A79B", roughness: 0.55, transparent: true, opacity: 0.55 } as const;
  return (
    <group>
      {/* Lobes: elongated ellipsoids, slightly tilted toward the midline at the top */}
      {[-1.05, 1.05].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, x < 0 ? -0.12 : 0.12]} scale={[0.62, 1.35, 0.55]}>
          <sphereGeometry args={[1, 48, 48]} />
          <meshStandardMaterial {...tissue} />
        </mesh>
      ))}
      {/* Isthmus */}
      <mesh position={[0, -0.45, 0.12]} rotation={[0, 0, Math.PI / 2]} scale={[0.32, 1, 0.28]}>
        <capsuleGeometry args={[0.6, 1.1, 8, 24]} />
        <meshStandardMaterial {...tissue} />
      </mesh>
      {/* Trachea behind the gland for orientation */}
      <mesh position={[0, 0, -0.55]}>
        <cylinderGeometry args={[0.55, 0.55, 4.2, 32, 1, true]} />
        <meshStandardMaterial color="#B9C7CF" transparent opacity={0.14} side={2} depthWrite={false} />
      </mesh>
      {detailed && (
        <>
          <Html position={[-1.05, 1.6, 0]} center className="pointer-events-none whitespace-nowrap text-xs font-semibold text-navy-700">الفص الأيمن</Html>
          <Html position={[1.05, 1.6, 0]} center className="pointer-events-none whitespace-nowrap text-xs font-semibold text-navy-700">الفص الأيسر</Html>
          <Html position={[0, -1.05, 0.3]} center className="pointer-events-none whitespace-nowrap text-xs font-semibold text-navy-700">البرزخ</Html>
        </>
      )}
    </group>
  );
}

function NoduleMesh({ n, selected, onSelect, showHistory, detailed }: { n: Model3DNodule; selected: boolean; onSelect: () => void; showHistory: boolean; detailed: boolean }) {
  const pos = nodulePosition(n.lobe, n.zone);
  const last = n.history[n.history.length - 1];
  const prev = n.history.length > 1 ? n.history[n.history.length - 2] : null;
  const color = RISK_COLOR[last.risk];
  const change = prev ? Math.round(((last.volumeMl - prev.volumeMl) / prev.volumeMl) * 100) : null;

  return (
    <group position={pos}>
      {/* Previous study: translucent ghost to compare size */}
      {showHistory && prev && (
        <mesh>
          <sphereGeometry args={[radiusFor(prev.volumeMl), 32, 32]} />
          <meshStandardMaterial color="#64748B" transparent opacity={0.28} wireframe />
        </mesh>
      )}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <sphereGeometry args={[radiusFor(last.volumeMl), 32, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.55 : 0.25} roughness={0.35} />
      </mesh>
      {selected && (
        <Html position={[0, radiusFor(last.volumeMl) + 0.15, 0]} center distanceFactor={6} zIndexRange={[20, 0]}>
          <div dir="rtl" className="w-52 rounded-xl bg-white p-3 text-start text-xs shadow-card ring-1 ring-navy-100">
            <p className="font-bold text-navy-800">العقدة {n.label}</p>
            <p className="text-ink-soft">{LOBE_AR[n.lobe]}، {ZONE_AR[n.zone]}</p>
            <p className="mt-1.5 font-semibold" style={{ color }}>{RISK_AR[last.risk]}{detailed && last.tirads ? <span dir="ltr"> · TR{last.tirads}</span> : null}</p>
            <p className="mt-1 text-ink-soft">أكبر بُعد <span dir="ltr">{last.maxDimMm} mm</span>{detailed ? <>، الحجم <span dir="ltr">{last.volumeMl} ml</span></> : null}</p>
            {change !== null && <p className={change > 20 ? "font-semibold text-red-600" : "text-ink-soft"}>التغير منذ الفحص السابق <span dir="ltr">{change > 0 ? "+" : ""}{change}%</span></p>}
            <p className="mt-1 text-ink-muted">آخر فحص {new Date(last.studyDate).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })}</p>
            {detailed && !last.reviewed && <p className="mt-1 font-semibold text-amber-700">نتيجة AI لم تُراجع بعد</p>}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Interactive thyroid. `mode="patient"` keeps wording simple; `mode="doctor"` adds labels, TI-RADS and history. */
export function ThyroidModel({ nodules, mode }: { nodules: Model3DNodule[]; mode: "patient" | "doctor" }) {
  const detailed = mode === "doctor";
  const [selected, setSelected] = useState<string | null>(nodules[0]?.id ?? null);
  const [showHistory, setShowHistory] = useState(detailed);
  const hasHistory = useMemo(() => nodules.some((n) => n.history.length > 1), [nodules]);

  return (
    <div className="overflow-hidden rounded-2xl border border-navy-100 bg-gradient-to-b from-white to-navy-50">
      <div className="relative h-[360px] sm:h-[420px]" role="img" aria-label={`نموذج ثلاثي الأبعاد للغدة الدرقية يوضح ${nodules.length} عقدة`}>
        <Canvas camera={{ position: [0, 0.3, 5.2], fov: 42 }} onPointerMissed={() => setSelected(null)} dpr={[1, 2]}>
          <ambientLight intensity={0.75} />
          <directionalLight position={[3, 4, 5]} intensity={1.1} />
          <directionalLight position={[-4, -2, -3]} intensity={0.35} />
          <Suspense fallback={null}>
            <Gland detailed={detailed} />
            {nodules.map((n) => (
              <NoduleMesh key={n.id} n={n} selected={selected === n.id} onSelect={() => setSelected(n.id)} showHistory={showHistory} detailed={detailed} />
            ))}
          </Suspense>
          <OrbitControls enablePan={false} minDistance={3} maxDistance={9} />
        </Canvas>
        <p className="pointer-events-none absolute bottom-3 start-3 text-xs text-ink-muted">اسحب للتدوير، واستخدم العجلة للتكبير، واضغط على العقدة لعرض التفاصيل</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-navy-100 bg-white px-4 py-3 text-xs text-ink-soft">
        {(["LOW", "MODERATE", "HIGH", "SUSPICIOUS"] as const).map((r) => (
          <span key={r} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ background: RISK_COLOR[r] }} aria-hidden /> {r === "LOW" ? "حميدة/منخفضة" : RISK_AR[r]}
          </span>
        ))}
        {hasHistory && (
          <label className="ms-auto flex items-center gap-2 font-semibold text-navy-800">
            <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} className="h-4 w-4 accent-navy-800" />
            إظهار حجم الفحص السابق
          </label>
        )}
      </div>
      {nodules.length > 0 && (
        <ul className="flex flex-wrap gap-2 border-t border-navy-100 bg-white px-4 py-3">
          {nodules.map((n) => (
            <li key={n.id}>
              <button onClick={() => setSelected(n.id)} aria-pressed={selected === n.id} className={`rounded-full border px-3 py-1 text-xs font-semibold ${selected === n.id ? "border-navy-800 bg-navy-800 text-white" : "border-navy-100 text-navy-700"}`}>
                {n.label}، {LOBE_AR[n.lobe]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
