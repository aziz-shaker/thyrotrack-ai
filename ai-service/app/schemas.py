"""API contracts (mirrors the NoduleFinding model in the web app's Prisma schema)."""
from typing import Literal

from pydantic import BaseModel, Field

Lobe = Literal["RIGHT", "LEFT", "ISTHMUS"]
Zone = Literal["UPPER", "MIDDLE", "LOWER"]
Composition = Literal["CYSTIC", "SPONGIFORM", "MIXED", "SOLID"]
Echogenicity = Literal["ANECHOIC", "HYPERECHOIC", "ISOECHOIC", "HYPOECHOIC", "VERY_HYPOECHOIC"]
Shape = Literal["WIDER_THAN_TALL", "TALLER_THAN_WIDE"]
Margin = Literal["SMOOTH", "ILL_DEFINED", "LOBULATED", "EXTRATHYROIDAL"]
Focus = Literal["NONE", "COMET_TAIL", "MACRO", "RIM", "PUNCTATE"]
Risk = Literal["BENIGN", "LOW", "MODERATE", "HIGH", "SUSPICIOUS"]
View = Literal["TRANSVERSE", "SAGITTAL", "UNKNOWN"]


class BBox(BaseModel):
    x: float
    y: float
    w: float
    h: float


class FeatureExplanation(BaseModel):
    feature: str
    value: str
    points: int
    reason: str


class NoduleOut(BaseModel):
    image_index: int
    lobe: Lobe
    zone: Zone
    near_capsule: bool
    bbox: BBox  # normalized 0..1
    contour: list[list[float]]  # normalized polygon
    length_mm: float
    width_mm: float
    depth_mm: float
    volume_ml: float
    composition: Composition
    echogenicity: Echogenicity
    shape: Shape
    margin: Margin
    echogenic_foci: list[Focus]
    tirads_points: int
    tirads_level: int = Field(ge=1, le=5)
    risk: Risk
    malignancy_prob: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    suggested_action: Literal["FNA", "US_FOLLOW_UP", "NO_ACTION"]
    explanation: list[FeatureExplanation]


class AnalyzeResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    model_version: str
    image_quality: float
    duration_ms: int
    warnings: list[str]
    nodules: list[NoduleOut]
    disclaimer: str = (
        "AI-assisted findings for clinician review only. Not a diagnosis. Accuracy depends on image quality, "
        "ROI, device and may be reduced in Hashimoto thyroiditis or diffuse/non-nodular changes."
    )


class DicomConvertResponse(BaseModel):
    png_base64: str
    width: int
    height: int
    pixel_spacing_mm: float | None
    warnings: list[str]
