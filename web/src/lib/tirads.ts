/**
 * ACR TI-RADS (2017) scoring engine — deterministic rules, no ML.
 * The AI service extracts the features; this module turns them into points, level and recommendation.
 */
import type { Composition, Echogenicity, Shape, Margin, EchogenicFoci, RiskCategory } from "@prisma/client";

export const POINTS = {
  composition: { CYSTIC: 0, SPONGIFORM: 0, MIXED: 1, SOLID: 2 },
  echogenicity: { ANECHOIC: 0, HYPERECHOIC: 1, ISOECHOIC: 1, HYPOECHOIC: 2, VERY_HYPOECHOIC: 3 },
  shape: { WIDER_THAN_TALL: 0, TALLER_THAN_WIDE: 3 },
  margin: { SMOOTH: 0, ILL_DEFINED: 0, LOBULATED: 2, EXTRATHYROIDAL: 3 },
  foci: { NONE: 0, COMET_TAIL: 0, MACRO: 1, RIM: 2, PUNCTATE: 3 },
} as const;

export interface TiradsFeatures {
  composition: Composition;
  echogenicity: Echogenicity;
  shape: Shape;
  margin: Margin;
  echogenicFoci: EchogenicFoci[];
}

export interface TiradsResult {
  points: number;
  level: 1 | 2 | 3 | 4 | 5;
  breakdown: { feature: string; value: string; points: number }[];
}

export function scoreTirads(f: TiradsFeatures): TiradsResult {
  const foci = f.echogenicFoci.length ? f.echogenicFoci : (["NONE"] as EchogenicFoci[]);
  const breakdown = [
    { feature: "composition", value: f.composition, points: POINTS.composition[f.composition] },
    { feature: "echogenicity", value: f.echogenicity, points: POINTS.echogenicity[f.echogenicity] },
    { feature: "shape", value: f.shape, points: POINTS.shape[f.shape] },
    { feature: "margin", value: f.margin, points: POINTS.margin[f.margin] },
    // Echogenic foci are additive (choose all that apply)
    ...foci.map((v) => ({ feature: "echogenicFoci", value: v, points: POINTS.foci[v] })),
  ];
  const points = breakdown.reduce((s, b) => s + b.points, 0);
  return { points, level: levelFromPoints(points), breakdown };
}

export function levelFromPoints(p: number): 1 | 2 | 3 | 4 | 5 {
  if (p === 0) return 1;
  if (p <= 2) return 2; // ACR chart lists 2 pts; 1 pt is not defined — mapped conservatively to TR2

  if (p === 3) return 3;
  if (p <= 6) return 4;
  return 5;
}

/** Size thresholds (largest dimension, mm) for FNA vs follow-up — ACR 2017 */
const THRESHOLDS: Record<number, { fna?: number; follow?: number }> = {
  1: {},
  2: {},
  3: { fna: 25, follow: 15 },
  4: { fna: 15, follow: 10 },
  5: { fna: 10, follow: 5 },
};

export type SuggestedAction = "FNA" | "US_FOLLOW_UP" | "NO_ACTION";

export function suggestAction(level: number, maxDimMm: number): SuggestedAction {
  const t = THRESHOLDS[level];
  if (t.fna !== undefined && maxDimMm >= t.fna) return "FNA";
  if (t.follow !== undefined && maxDimMm >= t.follow) return "US_FOLLOW_UP";
  return "NO_ACTION";
}

export function riskFromLevel(level: number): RiskCategory {
  return (["BENIGN", "BENIGN", "LOW", "MODERATE", "HIGH", "SUSPICIOUS"] as RiskCategory[])[level] ?? "MODERATE";
}

/** Ellipsoid volume (ml) from three orthogonal diameters in mm */
export const ellipsoidVolumeMl = (l: number, w: number, d: number) => +((l * w * d * 0.5236) / 1000).toFixed(2);

/**
 * ATA growth definition: ≥20% increase in ≥2 dimensions with min 2 mm, OR >50% volume increase.
 */
export function isSignificantGrowth(
  prev: { l: number; w: number; d: number; v: number },
  cur: { l: number; w: number; d: number; v: number },
): boolean {
  const dims = [
    [prev.l, cur.l],
    [prev.w, cur.w],
    [prev.d, cur.d],
  ];
  const grown = dims.filter(([a, b]) => b - a >= 2 && b >= a * 1.2).length;
  return grown >= 2 || cur.v > prev.v * 1.5;
}

export const RISK_META: Record<RiskCategory, { ar: string; en: string; color: string; bg: string }> = {
  BENIGN: { ar: "حميدة", en: "Benign", color: "text-green-700", bg: "bg-green-100" },
  LOW: { ar: "خطورة منخفضة", en: "Low risk", color: "text-green-700", bg: "bg-green-100" },
  MODERATE: { ar: "خطورة متوسطة", en: "Moderate risk", color: "text-yellow-700", bg: "bg-yellow-100" },
  HIGH: { ar: "خطورة عالية", en: "High risk", color: "text-orange-700", bg: "bg-orange-100" },
  SUSPICIOUS: { ar: "مشتبه بالخبث", en: "Suspicious", color: "text-red-700", bg: "bg-red-100" },
};
