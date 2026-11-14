"""Orchestrates preprocessing → detection → segmentation → features → TI-RADS for one study."""
from __future__ import annotations

import time
from dataclasses import dataclass

import numpy as np

from ..config import Settings
from ..schemas import AnalyzeResponse, BBox, FeatureExplanation, NoduleOut
from . import tirads
from .base import Detector, FeatureExtractor, Segmenter
from .classical import ClassicalDetector, ClassicalFeatureExtractor, ClassicalSegmenter
from .preprocess import LoadedImage, quality_score, resize


@dataclass
class ImageInput:
    image: LoadedImage
    view: str  # TRANSVERSE | SAGITTAL | UNKNOWN
    pixel_spacing_mm: float | None  # caller override (manual calibration)


def _bbox(mask: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(mask)
    return int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)


def build_stages(s: Settings) -> tuple[Detector, Segmenter, FeatureExtractor]:
    """Backends are chosen from config — the rest of the system never imports a concrete model."""
    detector: Detector = ClassicalDetector()
    features: FeatureExtractor = ClassicalFeatureExtractor()
    if s.segmenter_backend == "torch":
        from .torch_backend import TorchSegmenter

        segmenter: Segmenter = TorchSegmenter(s.torch_weights_dir)
    else:
        segmenter = ClassicalSegmenter()
    if s.detector_backend not in ("classical",) or s.features_backend not in ("classical",):
        raise RuntimeError("Only 'classical' detector/features backends are bundled; see torch_backend.py")
    return detector, segmenter, features


class Analyzer:
    def __init__(self, settings: Settings):
        self.s = settings
        self.detector, self.segmenter, self.features = build_stages(settings)
        self.model_version = " + ".join([self.detector.name, self.segmenter.name, self.features.name, "tirads-rules@ACR2017"])

    def analyze(self, inputs: list[ImageInput]) -> AnalyzeResponse:
        t0 = time.perf_counter()
        n = self.s.work_size
        warnings: list[str] = []
        qualities: list[float] = []
        per_image = []

        for idx, inp in enumerate(inputs):
            warnings += [f"Image {idx + 1}: {w}" for w in inp.image.warnings]
            src = inp.image.gray
            img = resize(src, n)
            q, qw = quality_score(img)
            qualities.append(q)
            warnings += [f"Image {idx + 1}: {w}" for w in qw]

            spacing = inp.pixel_spacing_mm or inp.image.pixel_spacing_mm
            if spacing is None:
                spacing = self.s.default_pixel_spacing_mm
                warnings.append(f"Image {idx + 1}: no calibration — assumed {spacing} mm/pixel. Calibrate for accurate size.")
            # mm per *work* pixel, per axis (resizing may be anisotropic)
            sx = spacing * src.shape[1] / n
            sy = spacing * src.shape[0] / n

            dets = self.detector.detect(img)
            if dets:
                per_image.append((idx, inp, img, dets[0], sx, sy, q))

        quality = round(float(np.mean(qualities)), 2) if qualities else 0.0
        if quality < self.s.min_quality:
            warnings.append("Overall image quality is low — AI findings may be unreliable.")

        nodules: list[NoduleOut] = []
        trans = next((p for p in per_image if p[1].view == "TRANSVERSE"), None)
        sag = next((p for p in per_image if p[1].view == "SAGITTAL"), None)
        primary = trans or (per_image[0] if per_image else None)

        if primary is None:
            warnings.append("No nodule could be identified. The nodule may be iso/hyperechoic or outside the field of view — manual review required.")
        else:
            nodules.append(self._build_nodule(primary, sag, warnings))

        return AnalyzeResponse(
            model_version=self.model_version,
            image_quality=quality,
            duration_ms=int((time.perf_counter() - t0) * 1000),
            warnings=warnings,
            nodules=nodules,
        )

    def _build_nodule(self, primary, sag, warnings: list[str]) -> NoduleOut:
        idx, inp, img, det, sx, sy, q = primary
        n = self.s.work_size
        seg = self.segmenter.segment(img, det)
        feats = self.features.extract(img, seg)
        x, y, w, h = _bbox(seg.mask)

        # Measurements: transverse gives width (L-R) and depth (AP); sagittal gives length (cranio-caudal)
        width_mm = round(w * sx, 1)
        depth_mm = round(h * sy, 1)
        if sag is not None:
            sag_mask = self.segmenter.segment(sag[2], sag[3]).mask
            sag_box = _bbox(sag_mask)
            length_mm = round(sag_box[2] * sag[4], 1)
        else:
            length_mm = width_mm
            warnings.append("No sagittal view — length assumed equal to width; volume is approximate.")

        # Shape is judged on the transverse view: taller (AP) than wide
        shape = "TALLER_THAN_WIDE" if depth_mm > width_mm * 1.0 else "WIDER_THAN_TALL"

        # Location. Radiology convention: patient's RIGHT appears on image LEFT in transverse view.
        cxn = (x + w / 2) / n
        lobe = "RIGHT" if cxn < 0.42 else "LEFT" if cxn > 0.58 else "ISTHMUS"
        if sag is not None:
            sx_center = (sag_box[0] + sag_box[2] / 2) / n  # cranial on image left
            zone = "UPPER" if sx_center < 0.38 else "LOWER" if sx_center > 0.62 else "MIDDLE"
        else:
            zone = "MIDDLE"
            warnings.append("Zone (upper/middle/lower) needs a sagittal view — defaulted to middle.")
        near_capsule = (y / n) < 0.22 or ((y + h) / n) > 0.9

        pts, level = tirads.score(feats.composition, feats.echogenicity, shape, feats.margin, feats.foci)
        max_dim = max(length_mm, width_mm, depth_mm)
        conf = float(np.clip(0.45 * det.score + 0.35 * feats.certainty + 0.2 * q, 0.05, 0.97))

        expl = [
            FeatureExplanation(feature="composition", value=feats.composition, points=tirads.POINTS["composition"][feats.composition], reason=feats.reasons["composition"]),
            FeatureExplanation(feature="echogenicity", value=feats.echogenicity, points=tirads.POINTS["echogenicity"][feats.echogenicity], reason=feats.reasons["echogenicity"]),
            FeatureExplanation(feature="shape", value=shape, points=tirads.POINTS["shape"][shape], reason=f"depth {depth_mm} mm vs width {width_mm} mm on transverse view"),
            FeatureExplanation(feature="margin", value=feats.margin, points=tirads.POINTS["margin"][feats.margin], reason=feats.reasons["margin"]),
        ] + [
            FeatureExplanation(feature="echogenicFoci", value=f, points=tirads.POINTS["foci"][f], reason=feats.reasons["foci"]) for f in feats.foci
        ]

        return NoduleOut(
            image_index=idx,
            lobe=lobe,
            zone=zone,
            near_capsule=near_capsule,
            bbox=BBox(x=round(x / n, 4), y=round(y / n, 4), w=round(w / n, 4), h=round(h / n, 4)),
            contour=[[round(px / n, 4), round(py / n, 4)] for px, py in seg.contour],
            length_mm=length_mm,
            width_mm=width_mm,
            depth_mm=depth_mm,
            volume_ml=tirads.ellipsoid_volume_ml(length_mm, width_mm, depth_mm),
            composition=feats.composition,
            echogenicity=feats.echogenicity,
            shape=shape,
            margin=feats.margin,
            echogenic_foci=feats.foci,
            tirads_points=pts,
            tirads_level=level,
            risk=tirads.RISK_BY_LEVEL[level],
            malignancy_prob=tirads.MALIGNANCY_PRIOR[level],
            confidence=round(conf, 2),
            suggested_action=tirads.suggest_action(level, max_dim),
            explanation=expl,
        )
