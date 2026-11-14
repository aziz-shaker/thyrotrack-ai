"""Stage interfaces. Any backend (classical CV, PyTorch/MONAI, ONNX...) implements these."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import numpy as np


@dataclass
class Detection:
    mask: np.ndarray  # bool, work_size x work_size
    bbox: tuple[int, int, int, int]  # x, y, w, h in work pixels
    score: float  # 0..1 detection strength


@dataclass
class Segmentation:
    mask: np.ndarray
    contour: list[tuple[float, float]]  # work-pixel polygon
    radii: np.ndarray  # ray lengths from centroid (used for margin regularity)
    centroid: tuple[float, float]


@dataclass
class Features:
    composition: str
    echogenicity: str
    margin: str
    foci: list[str]
    reasons: dict[str, str]
    certainty: float  # 0..1 — how clear-cut the feature calls were


class Detector(Protocol):
    name: str

    def detect(self, img: np.ndarray) -> list[Detection]: ...


class Segmenter(Protocol):
    name: str

    def segment(self, img: np.ndarray, det: Detection) -> Segmentation: ...


class FeatureExtractor(Protocol):
    name: str

    def extract(self, img: np.ndarray, seg: Segmentation) -> Features: ...
