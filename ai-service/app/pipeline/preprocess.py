"""Image loading, DICOM conversion, normalization and quality scoring."""
from __future__ import annotations

import io
from dataclasses import dataclass, field

import numpy as np
from PIL import Image

DICOM_MAGIC_OFFSET = 128


@dataclass
class LoadedImage:
    gray: np.ndarray  # float32 [0,1], original resolution
    pixel_spacing_mm: float | None
    is_dicom: bool
    warnings: list[str] = field(default_factory=list)


def is_dicom(data: bytes) -> bool:
    return len(data) > 132 and data[DICOM_MAGIC_OFFSET:DICOM_MAGIC_OFFSET + 4] == b"DICM"


def load_image(data: bytes) -> LoadedImage:
    if is_dicom(data):
        return _load_dicom(data)
    img = Image.open(io.BytesIO(data))
    img.verify()  # reject truncated/corrupt files early
    img = Image.open(io.BytesIO(data)).convert("L")
    return LoadedImage(np.asarray(img, dtype=np.float32) / 255.0, None, False)


def _load_dicom(data: bytes) -> LoadedImage:
    import pydicom

    ds = pydicom.dcmread(io.BytesIO(data))
    warnings: list[str] = []
    try:
        arr = ds.pixel_array.astype(np.float32)
    except Exception as exc:  # compressed transfer syntaxes need extra codecs
        raise ValueError(f"Unsupported DICOM pixel data: {exc}") from exc
    if arr.ndim == 4:  # multi-frame color → first frame
        arr = arr[0]
    if arr.ndim == 3:
        arr = arr[0] if arr.shape[0] < 5 else arr.mean(axis=-1)  # multi-frame gray or RGB
    lo, hi = np.percentile(arr, [0.5, 99.5])
    gray = np.clip((arr - lo) / max(hi - lo, 1e-6), 0, 1)

    spacing = None
    # Ultrasound stores calibration in SequenceOfUltrasoundRegions (cm/pixel)
    regions = getattr(ds, "SequenceOfUltrasoundRegions", None)
    if regions:
        dx = getattr(regions[0], "PhysicalDeltaX", None)
        if dx:
            spacing = float(dx) * 10.0
    if spacing is None and "PixelSpacing" in ds:
        spacing = float(ds.PixelSpacing[0])
    if spacing is None:
        warnings.append("DICOM has no pixel spacing — measurements use a default calibration.")
    return LoadedImage(gray.astype(np.float32), spacing, True, warnings)


def to_png_bytes(gray: np.ndarray) -> bytes:
    buf = io.BytesIO()
    Image.fromarray((np.clip(gray, 0, 1) * 255).astype(np.uint8)).save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def resize(gray: np.ndarray, size: int) -> np.ndarray:
    img = Image.fromarray((gray * 255).astype(np.uint8)).resize((size, size), Image.BILINEAR)
    return np.asarray(img, dtype=np.float32) / 255.0


def box_blur(a: np.ndarray, k: int) -> np.ndarray:
    """Fast separable box blur via cumulative sums (no scipy dependency)."""
    pad = k // 2
    p = np.pad(a, pad, mode="edge")
    c = np.cumsum(np.cumsum(p, axis=0), axis=1)
    c = np.pad(c, ((1, 0), (1, 0)))
    s = c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]
    return (s / (k * k))[: a.shape[0], : a.shape[1]]


def quality_score(gray: np.ndarray) -> tuple[float, list[str]]:
    """Heuristic 0..1 score from contrast and sharpness (variance of Laplacian)."""
    warnings: list[str] = []
    contrast = float(gray.std())
    lap = gray[1:-1, 1:-1] * 4 - gray[:-2, 1:-1] - gray[2:, 1:-1] - gray[1:-1, :-2] - gray[1:-1, 2:]
    sharp = float(lap.var())
    q = 0.55 * min(contrast / 0.2, 1.0) + 0.45 * min(sharp / 0.01, 1.0)
    if contrast < 0.08:
        warnings.append("Low image contrast — consider adjusting gain before acquisition.")
    if sharp < 0.002:
        warnings.append("Image appears blurry — measurements may be unreliable.")
    return round(float(np.clip(q, 0, 1)), 2), warnings
