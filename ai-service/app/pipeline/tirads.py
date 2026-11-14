"""ACR TI-RADS (2017) rules — deterministic. Mirrors web/src/lib/tirads.ts (keep both in sync; tests cover both)."""

POINTS = {
    "composition": {"CYSTIC": 0, "SPONGIFORM": 0, "MIXED": 1, "SOLID": 2},
    "echogenicity": {"ANECHOIC": 0, "HYPERECHOIC": 1, "ISOECHOIC": 1, "HYPOECHOIC": 2, "VERY_HYPOECHOIC": 3},
    "shape": {"WIDER_THAN_TALL": 0, "TALLER_THAN_WIDE": 3},
    "margin": {"SMOOTH": 0, "ILL_DEFINED": 0, "LOBULATED": 2, "EXTRATHYROIDAL": 3},
    "foci": {"NONE": 0, "COMET_TAIL": 0, "MACRO": 1, "RIM": 2, "PUNCTATE": 3},
}

# (FNA threshold mm, follow-up threshold mm) by level
THRESHOLDS = {3: (25, 15), 4: (15, 10), 5: (10, 5)}

RISK_BY_LEVEL = {1: "BENIGN", 2: "LOW", 3: "MODERATE", 4: "HIGH", 5: "SUSPICIOUS"}

# Approximate malignancy rates reported per ACR TR level (used as a prior, not a prediction)
MALIGNANCY_PRIOR = {1: 0.003, 2: 0.015, 3: 0.048, 4: 0.091, 5: 0.35}


def score(composition: str, echogenicity: str, shape: str, margin: str, foci: list[str]) -> tuple[int, int]:
    foci = foci or ["NONE"]
    pts = (
        POINTS["composition"][composition]
        + POINTS["echogenicity"][echogenicity]
        + POINTS["shape"][shape]
        + POINTS["margin"][margin]
        + sum(POINTS["foci"][f] for f in foci)
    )
    return pts, level_from_points(pts)


def level_from_points(p: int) -> int:
    if p == 0:
        return 1
    if p <= 2:  # 1 pt is undefined in the ACR chart → conservatively TR2
        return 2
    if p == 3:
        return 3
    if p <= 6:
        return 4
    return 5


def suggest_action(level: int, max_dim_mm: float) -> str:
    t = THRESHOLDS.get(level)
    if not t:
        return "NO_ACTION"
    fna, follow = t
    if max_dim_mm >= fna:
        return "FNA"
    if max_dim_mm >= follow:
        return "US_FOLLOW_UP"
    return "NO_ACTION"


def ellipsoid_volume_ml(l_mm: float, w_mm: float, d_mm: float) -> float:
    return round(l_mm * w_mm * d_mm * 0.5236 / 1000, 2)
