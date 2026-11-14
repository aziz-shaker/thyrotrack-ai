"""Service configuration — every model stage is swappable via environment variables."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Stage backends: "classical" (built-in CV baseline) or "torch" (needs weights, see pipeline/torch_backend.py)
    detector_backend: str = "classical"
    segmenter_backend: str = "classical"
    features_backend: str = "classical"
    torch_weights_dir: str = "./weights"

    # Preprocessing
    work_size: int = 256  # images are resized to work_size x work_size for analysis
    default_pixel_spacing_mm: float = 0.1  # used when neither DICOM nor caller provides spacing

    # Guards
    max_image_mb: int = 15
    max_images_per_request: int = 8
    min_quality: float = 0.35

    service_token: str = ""  # optional shared secret with the web app (header X-Service-Token)


@lru_cache
def get_settings() -> Settings:
    return Settings()
