"""
Synthetic thyroid ultrasound generator — for demos and tests only (no real patient images).
Renders speckle, an ultrasound fan, thyroid lobes and a nodule with configurable TI-RADS-relevant appearance.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from PIL import Image, ImageFilter


@dataclass
class NoduleSpec:
    cx: float  # normalized center
    cy: float
    rx: float  # normalized radii
    ry: float
    echo: str = "HYPOECHOIC"  # ANECHOIC|HYPOECHOIC|VERY_HYPOECHOIC|ISOECHOIC
    lobulated: bool = False
    foci: list[str] = field(default_factory=list)  # PUNCTATE|MACRO


ECHO_LEVEL = {"ANECHOIC": 0.03, "VERY_HYPOECHOIC": 0.16, "HYPOECHOIC": 0.3, "ISOECHOIC": 0.5, "HYPERECHOIC": 0.62}


def render(spec: NoduleSpec | None, view: str = "TRANSVERSE", size: tuple[int, int] = (800, 600), seed: int = 0) -> Image.Image:
    rng = np.random.default_rng(seed)
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w] / np.array([h, w])[:, None, None]

    base = np.full((h, w), 0.32)
    # Subcutaneous layers / strap muscles (darker band near the top)
    base -= 0.12 * np.exp(-((yy - 0.16) ** 2) / 0.004)
    # Thyroid: two lobes + isthmus in transverse, one elongated lobe in sagittal
    if view == "TRANSVERSE":
        gland = np.maximum(
            np.exp(-(((xx - 0.3) / 0.2) ** 2 + ((yy - 0.52) / 0.24) ** 2) * 2),
            np.exp(-(((xx - 0.7) / 0.2) ** 2 + ((yy - 0.52) / 0.24) ** 2) * 2),
        )
        gland = np.maximum(gland, np.exp(-(((xx - 0.5) / 0.12) ** 2 + ((yy - 0.38) / 0.06) ** 2) * 2) * 0.8)
        # Trachea: bright air interface + acoustic shadow extending to the bottom of the image
        base += 0.35 * np.exp(-(((xx - 0.5) / 0.07) ** 2 + ((yy - 0.5) / 0.012) ** 2))
        base -= 0.3 * np.exp(-(((xx - 0.5) / 0.065) ** 2)) * (yy > 0.52)
    else:
        gland = np.exp(-(((xx - 0.5) / 0.36) ** 2 + ((yy - 0.5) / 0.2) ** 2) * 2)
    base += 0.3 * gland

    if spec:
        r = np.sqrt(((xx - spec.cx) / spec.rx) ** 2 + ((yy - spec.cy) / spec.ry) ** 2)
        if spec.lobulated:
            ang = np.arctan2(yy - spec.cy, xx - spec.cx)
            r = r * (1 + 0.14 * np.sin(ang * 5))
        inside = r < 1
        level = ECHO_LEVEL.get(spec.echo, 0.3)
        edge = np.clip((1.06 - r) / 0.06, 0, 1)  # soft boundary
        base = base * (1 - edge) + level * edge
        # Posterior acoustic enhancement for cystic nodules
        if spec.echo == "ANECHOIC":
            base += 0.12 * ((xx - spec.cx) ** 2 < spec.rx**2 * 0.6) * (yy > spec.cy + spec.ry)
        for f in spec.foci:
            ys, xs = np.nonzero(inside)
            if not len(xs):
                continue
            k = 7 if f == "PUNCTATE" else 1
            for _ in range(k):
                i = rng.integers(len(xs))
                rad = 3 if f == "PUNCTATE" else 14
                base[max(0, ys[i] - rad): ys[i] + rad, max(0, xs[i] - rad): xs[i] + rad] = 0.95

    # Multiplicative speckle (Rayleigh-like) + mild blur
    speckle = rng.rayleigh(0.8, size=(h, w))
    img = np.clip(base * speckle, 0, 1)
    # Depth attenuation
    img *= 1 - 0.35 * yy
    # Linear-probe field of view: black outside a trapezoid
    fov = (yy > 0.04) & (yy < 0.97) & (xx > 0.03 + 0.02 * yy) & (xx < 0.97 - 0.02 * yy)
    img = np.where(fov, img, 0)
    pil = Image.fromarray((img * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))
    return pil
