"""
Placeholder for trained models (e.g. a MONAI U-Net for segmentation, a ResNet for features).

To plug one in:
  1. pip install torch monai
  2. put weights in TORCH_WEIGHTS_DIR (e.g. ./weights/seg_unet.pt)
  3. set SEGMENTER_BACKEND=torch (and/or DETECTOR_BACKEND / FEATURES_BACKEND)
The class must keep the same interface as pipeline/base.py — nothing else in the system changes.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from .base import Detection, Segmentation


class TorchSegmenter:
    name = "torch-unet-seg"

    def __init__(self, weights_dir: str):
        path = Path(weights_dir) / "seg_unet.pt"
        if not path.exists():
            raise RuntimeError(f"SEGMENTER_BACKEND=torch but weights not found at {path}")
        import torch  # imported lazily so the classical backend has no torch dependency

        self.model = torch.jit.load(str(path)).eval()
        self.torch = torch
        self.name = f"torch-unet-seg@{path.stat().st_mtime_ns}"

    def segment(self, img: np.ndarray, det: Detection) -> Segmentation:  # pragma: no cover - needs weights
        with self.torch.no_grad():
            x = self.torch.from_numpy(img)[None, None].float()
            prob = self.torch.sigmoid(self.model(x))[0, 0].numpy()
        mask = prob > 0.5
        # Reuse the classical ray-cast to turn the predicted mask into a polygon
        from .classical import ClassicalSegmenter

        return ClassicalSegmenter().segment(img, Detection(mask, det.bbox, det.score))
