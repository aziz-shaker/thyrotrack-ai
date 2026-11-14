/** ACR TI-RADS rules — same cases as ai-service/tests/test_tirads.py (both engines must agree). */
import { scoreTirads, suggestAction, ellipsoidVolumeMl, isSignificantGrowth, riskFromLevel } from "@/lib/tirads";

type F = Parameters<typeof scoreTirads>[0];
const f = (composition: F["composition"], echogenicity: F["echogenicity"], shape: F["shape"], margin: F["margin"], echogenicFoci: F["echogenicFoci"]): F => ({
  composition,
  echogenicity,
  shape,
  margin,
  echogenicFoci,
});

describe("scoreTirads", () => {
  it.each([
    [f("CYSTIC", "ANECHOIC", "WIDER_THAN_TALL", "SMOOTH", ["NONE"]), 0, 1],
    [f("SPONGIFORM", "ISOECHOIC", "WIDER_THAN_TALL", "SMOOTH", ["NONE"]), 1, 2],
    [f("MIXED", "ISOECHOIC", "WIDER_THAN_TALL", "SMOOTH", ["COMET_TAIL"]), 2, 2],
    [f("SOLID", "ISOECHOIC", "WIDER_THAN_TALL", "SMOOTH", ["NONE"]), 3, 3],
    [f("SOLID", "HYPOECHOIC", "WIDER_THAN_TALL", "SMOOTH", ["NONE"]), 4, 4],
    [f("SOLID", "VERY_HYPOECHOIC", "TALLER_THAN_WIDE", "LOBULATED", ["PUNCTATE"]), 13, 5],
    [f("SOLID", "HYPOECHOIC", "WIDER_THAN_TALL", "SMOOTH", ["MACRO", "RIM"]), 7, 5],
  ])("case %#", (features, points, level) => {
    const r = scoreTirads(features);
    expect(r.points).toBe(points);
    expect(r.level).toBe(level);
  });

  it("treats empty foci as NONE and explains every feature", () => {
    const r = scoreTirads(f("SOLID", "HYPOECHOIC", "WIDER_THAN_TALL", "SMOOTH", []));
    expect(r.points).toBe(4);
    expect(r.breakdown.map((b) => b.feature)).toEqual(["composition", "echogenicity", "shape", "margin", "echogenicFoci"]);
  });
});

describe("suggestAction (ACR size thresholds)", () => {
  it.each([
    [1, 40, "NO_ACTION"], [3, 25, "FNA"], [3, 20, "US_FOLLOW_UP"], [3, 10, "NO_ACTION"],
    [4, 15, "FNA"], [4, 12, "US_FOLLOW_UP"], [5, 10, "FNA"], [5, 6, "US_FOLLOW_UP"], [5, 4, "NO_ACTION"],
  ])("TR%i at %i mm → %s", (level, size, action) => {
    expect(suggestAction(level, size)).toBe(action);
  });
});

describe("measurements", () => {
  it("ellipsoid volume", () => expect(ellipsoidVolumeMl(20, 10, 10)).toBe(1.05));

  it("ATA growth: ≥20% in two dimensions with ≥2 mm", () => {
    expect(isSignificantGrowth({ l: 10, w: 10, d: 10, v: 0.52 }, { l: 12.5, w: 12.5, d: 10, v: 0.82 })).toBe(true);
    // 20% but < 2 mm absolute → not significant
    expect(isSignificantGrowth({ l: 5, w: 5, d: 5, v: 0.07 }, { l: 6, w: 6, d: 5, v: 0.09 })).toBe(false);
  });

  it("ATA growth: >50% volume", () => {
    expect(isSignificantGrowth({ l: 10, w: 10, d: 10, v: 0.52 }, { l: 11, w: 11, d: 11, v: 0.8 })).toBe(true);
  });

  it("maps levels to risk categories", () => {
    expect([1, 2, 3, 4, 5].map(riskFromLevel)).toEqual(["BENIGN", "LOW", "MODERATE", "HIGH", "SUSPICIOUS"]);
  });
});
