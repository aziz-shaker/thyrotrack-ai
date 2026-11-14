"""
Classical computer-vision baseline (no trained weights).

Detection: hypoechoic blobs = connected regions noticeably darker than surrounding tissue,
           fully inside the imaged area. Works for typical solid/cystic nodules; it will miss
           iso/hyperechoic nodules — that is exactly the gap a trained model fills (see torch_backend.py).
Segmentation: ray casting from the blob centroid → smooth polygon.
Features: intensity statistics inside vs. around the nodule.
"""
from __future__ import annotations

from collections import deque

import numpy as np

from .base import Detection, Features, Segmentation
from .preprocess import box_blur

N_RAYS = 48


def _components(mask: np.ndarray) -> list[np.ndarray]:
    """4-connected components (BFS). Returns list of boolean masks."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    comps: list[np.ndarray] = []
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if seen[y0, x0]:
            continue
        q = deque([(y0, x0)])
        seen[y0, x0] = True
        pts = []
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        comp = np.zeros_like(mask, dtype=bool)
        py, px = zip(*pts)
        comp[list(py), list(px)] = True
        comps.append(comp)
    return comps


def _ring(mask: np.ndarray, width: int) -> np.ndarray:
    """Band of pixels just outside the mask."""
    dil = box_blur(mask.astype(np.float32), width * 2 + 1) > 0.01
    return dil & ~mask


class ClassicalDetector:
    name = "classical-detector@1.0"

    def detect(self, img: np.ndarray) -> list[Detection]:
        n = img.shape[0]
        smooth = box_blur(img, 13)
        # Local reference = large-scale brightness around each pixel. Comparing to the *local*
        # background (not a global median) compensates depth attenuation and gain differences.
        background = box_blur(img, 81)
        # Imaged area: exclude black background outside the ultrasound field of view
        # (blurred so dark nodules inside the field are not mistaken for background)
        valid = box_blur((box_blur(img, 9) > 0.02).astype(np.float32), 15) > 0.97
        if valid.sum() < n * n * 0.2:
            return []
        dark = (smooth < background * 0.8) & valid

        out: list[Detection] = []
        for comp in _components(dark):
            area = comp.sum() / (n * n)
            if not (0.003 < area < 0.3):
                continue
            ys, xs = np.nonzero(comp)
            # Must not touch the image border or the edge of the field of view
            # (rejects acoustic shadows such as the trachea's, which run to the bottom of the image)
            if ys.min() < 3 or xs.min() < 3 or ys.max() > n - 4 or xs.max() > n - 4:
                continue
            if (_ring(comp, 3) & ~valid).any():
                continue
            # Shadows are long vertical streaks; nodules are roughly elliptical
            if (ys.max() - ys.min()) > 2.5 * (xs.max() - xs.min() + 1):
                continue
            ring = _ring(comp, 6) & valid
            if ring.sum() == 0:
                continue
            contrast = float(smooth[ring].mean() - smooth[comp].mean())
            score = float(np.clip(contrast / 0.35, 0, 1) * np.clip(area / 0.02, 0.3, 1))
            x, y = int(xs.min()), int(ys.min())
            out.append(Detection(comp, (x, y, int(xs.max()) - x + 1, int(ys.max()) - y + 1), score))
        return sorted(out, key=lambda d: d.score, reverse=True)[:3]


class ClassicalSegmenter:
    name = "classical-raycast-seg@1.0"

    def segment(self, img: np.ndarray, det: Detection) -> Segmentation:
        n = img.shape[0]
        # Detection keeps only the darkest core; grow it to the real (softer) boundary with a looser
        # local-contrast threshold, limited to the neighbourhood of the detected core.
        near = box_blur(det.mask.astype(np.float32), 2 * max(6, max(det.bbox[2], det.bbox[3]) // 3) + 1) > 0
        loose = (box_blur(img, 9) < box_blur(img, 81) * 0.92) & near
        grown = det.mask.copy()
        for comp in _components(loose):
            if (comp & det.mask).any():
                grown |= comp
        det = Detection(grown, det.bbox, det.score)
        ys, xs = np.nonzero(grown)
        cy, cx = float(ys.mean()), float(xs.mean())
        radii = np.zeros(N_RAYS)
        contour: list[tuple[float, float]] = []
        max_r = max(det.bbox[2], det.bbox[3]) * 1.2
        for i in range(N_RAYS):
            a = 2 * np.pi * i / N_RAYS
            r_hit = 0.0
            r = 0.0
            while r < max_r:
                x, y = int(round(cx + np.cos(a) * r)), int(round(cy + np.sin(a) * r))
                if not (0 <= x < n and 0 <= y < n):
                    break
                if det.mask[y, x]:
                    r_hit = r
                r += 0.5
            radii[i] = r_hit
        # Light circular smoothing of the boundary
        sm = (np.roll(radii, 1) + radii * 2 + np.roll(radii, -1)) / 4
        for i in range(N_RAYS):
            a = 2 * np.pi * i / N_RAYS
            contour.append((cx + np.cos(a) * sm[i], cy + np.sin(a) * sm[i]))
        return Segmentation(det.mask, contour, radii, (cx, cy))


class ClassicalFeatureExtractor:
    name = "classical-features@1.0"

    def extract(self, img: np.ndarray, seg: Segmentation) -> Features:
        inside = img[seg.mask]
        ring = _ring(seg.mask, 8)
        around = img[ring] if ring.any() else img.ravel()
        mi, ma = float(inside.mean()), float(around.mean())
        ratio = mi / max(ma, 1e-6)
        very_dark = float((inside < 0.08).mean())
        reasons: dict[str, str] = {}
        certainty = []

        # Composition
        if very_dark > 0.85:
            comp = "CYSTIC"
            reasons["composition"] = f"{very_dark:.0%} of the nodule is fluid-dark"
        elif 0.25 < very_dark <= 0.85:
            comp = "MIXED"
            reasons["composition"] = f"{very_dark:.0%} fluid-dark with solid component"
        else:
            comp = "SOLID"
            reasons["composition"] = "predominantly solid tissue signal"
        certainty.append(0.6 if min(abs(very_dark - 0.25), abs(very_dark - 0.85)) < 0.1 else 0.9)

        # Echogenicity (vs. surrounding thyroid parenchyma)
        if comp == "CYSTIC":
            echo = "ANECHOIC"
        elif ratio > 1.12:
            echo = "HYPERECHOIC"
        elif ratio > 0.85:
            echo = "ISOECHOIC"
        elif ratio > 0.45:
            echo = "HYPOECHOIC"
        else:
            echo = "VERY_HYPOECHOIC"
        reasons["echogenicity"] = f"mean intensity is {ratio:.0%} of surrounding tissue"
        certainty.append(0.6 if any(abs(ratio - t) < 0.06 for t in (1.12, 0.85, 0.45)) else 0.9)

        # Margin: irregularity of boundary radii
        r = seg.radii[seg.radii > 0]
        irregularity = float(r.std() / r.mean()) if r.size else 0.0
        if irregularity > 0.2:
            margin = "LOBULATED"
        elif irregularity > 0.13:
            margin = "ILL_DEFINED"
        else:
            margin = "SMOOTH"
        reasons["margin"] = f"boundary irregularity index {irregularity:.2f}"
        certainty.append(0.6 if abs(irregularity - 0.2) < 0.03 else 0.85)

        # Echogenic foci: small bright specks inside a non-cystic nodule
        # Bright relative to the (dark) nodule interior AND brighter than surrounding parenchyma
        bright = (img > max(mi * 2.4, ma * 1.25)) & seg.mask
        nb = int(bright.sum())
        frac = nb / max(int(seg.mask.sum()), 1)
        if comp == "CYSTIC" or nb < 2:
            foci = ["NONE"]
            reasons["foci"] = "no bright foci detected"
        elif frac > 0.04:
            foci = ["MACRO"]
            reasons["foci"] = f"large bright area ({frac:.1%} of nodule) consistent with macrocalcification"
        else:
            foci = ["PUNCTATE"]
            reasons["foci"] = f"{nb} small bright specks inside the nodule"
        certainty.append(0.7)

        return Features(comp, echo, margin, foci, reasons, float(np.mean(certainty)))
