"""ThyroTrack AI service — FastAPI. Swagger UI at /docs."""
from __future__ import annotations

import base64
import json
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile

from .config import Settings, get_settings
from .pipeline.analyzer import Analyzer, ImageInput
from .pipeline.preprocess import load_image, to_png_bytes
from .schemas import AnalyzeResponse, DicomConvertResponse

app = FastAPI(
    title="ThyroTrack AI Service",
    version="1.0.0",
    description="Thyroid nodule detection, segmentation and ACR TI-RADS scoring. AI-assisted findings for clinician review only.",
)

_analyzer: Analyzer | None = None


def analyzer() -> Analyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = Analyzer(get_settings())
    return _analyzer


def check_token(x_service_token: Annotated[str | None, Header()] = None, s: Settings = Depends(get_settings)) -> None:
    if s.service_token and x_service_token != s.service_token:
        raise HTTPException(401, "Invalid service token")


async def _read(f: UploadFile, s: Settings) -> bytes:
    data = await f.read(s.max_image_mb * 1024 * 1024 + 1)
    if len(data) > s.max_image_mb * 1024 * 1024:
        raise HTTPException(413, f"{f.filename}: larger than {s.max_image_mb} MB")
    return data


@app.get("/health", tags=["system"])
def health() -> dict:
    return {"status": "ok", "model_version": analyzer().model_version}


@app.post("/v1/analyze", response_model=AnalyzeResponse, tags=["analysis"], dependencies=[Depends(check_token)])
async def analyze(
    images: Annotated[list[UploadFile], File(description="Ultrasound images (PNG/JPG/DICOM)")],
    meta: Annotated[str, Form(description='JSON list: [{"view":"TRANSVERSE","pixel_spacing_mm":0.08}, ...]')] = "[]",
    s: Settings = Depends(get_settings),
) -> AnalyzeResponse:
    if not images or len(images) > s.max_images_per_request:
        raise HTTPException(400, f"Send 1..{s.max_images_per_request} images")
    try:
        metas = json.loads(meta) if meta else []
        assert isinstance(metas, list)
    except Exception:
        raise HTTPException(400, "meta must be a JSON list")

    inputs: list[ImageInput] = []
    for i, f in enumerate(images):
        m = metas[i] if i < len(metas) and isinstance(metas[i], dict) else {}
        try:
            loaded = load_image(await _read(f, s))
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(422, f"{f.filename}: unreadable image ({exc.__class__.__name__})")
        view = m.get("view") if m.get("view") in ("TRANSVERSE", "SAGITTAL") else "UNKNOWN"
        spacing = m.get("pixel_spacing_mm")
        inputs.append(ImageInput(loaded, view, float(spacing) if isinstance(spacing, (int, float)) and spacing > 0 else None))

    return analyzer().analyze(inputs)


@app.post("/v1/dicom/convert", response_model=DicomConvertResponse, tags=["imaging"], dependencies=[Depends(check_token)])
async def dicom_convert(file: Annotated[UploadFile, File()], s: Settings = Depends(get_settings)) -> DicomConvertResponse:
    """Convert DICOM → PNG + calibration. Only pixels are kept: patient tags are dropped (de-identification by design)."""
    data = await _read(file, s)
    try:
        img = load_image(data)
    except Exception as exc:
        raise HTTPException(422, f"Unreadable DICOM: {exc}")
    if not img.is_dicom:
        raise HTTPException(400, "Not a DICOM file")
    png = to_png_bytes(img.gray)
    return DicomConvertResponse(
        png_base64=base64.b64encode(png).decode(),
        width=img.gray.shape[1],
        height=img.gray.shape[0],
        pixel_spacing_mm=img.pixel_spacing_mm,
        warnings=img.warnings,
    )
