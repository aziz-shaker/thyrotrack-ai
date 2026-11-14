"""End-to-end pipeline tests on synthetic ultrasound (no real patient data)."""
import io

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app.pipeline.analyzer import Analyzer, ImageInput
from app.pipeline.preprocess import load_image
from app.synthetic import NoduleSpec, render


def _png(spec, view="TRANSVERSE", seed=3) -> bytes:
    b = io.BytesIO()
    render(spec, view, seed=seed).save(b, format="PNG")
    return b.getvalue()


def _analyze(spec: NoduleSpec):
    sag = NoduleSpec(0.5, 0.5, spec.rx * 1.3, spec.ry, spec.echo, spec.lobulated, spec.foci)
    return Analyzer(Settings()).analyze([
        ImageInput(load_image(_png(spec)), "TRANSVERSE", 0.06),
        ImageInput(load_image(_png(sag, "SAGITTAL")), "SAGITTAL", 0.06),
    ])


@pytest.mark.parametrize(
    "spec,lobe,composition,echo",
    [
        (NoduleSpec(0.3, 0.5, 0.09, 0.07, "HYPOECHOIC"), "RIGHT", "SOLID", "HYPOECHOIC"),
        (NoduleSpec(0.7, 0.5, 0.06, 0.09, "VERY_HYPOECHOIC", True, ["PUNCTATE"]), "LEFT", "SOLID", "VERY_HYPOECHOIC"),
        (NoduleSpec(0.32, 0.5, 0.1, 0.08, "ANECHOIC"), "RIGHT", "CYSTIC", "ANECHOIC"),
    ],
)
def test_detects_and_classifies(spec, lobe, composition, echo):
    r = _analyze(spec)
    assert len(r.nodules) == 1
    n = r.nodules[0]
    assert (n.lobe, n.composition, n.echogenicity) == (lobe, composition, echo)
    # Detected center within 5% of the true center (radiology: image-left = patient-right)
    assert abs(n.bbox.x + n.bbox.w / 2 - spec.cx) < 0.05
    assert abs(n.bbox.y + n.bbox.h / 2 - spec.cy) < 0.05
    assert n.zone == "MIDDLE"


def test_taller_than_wide_and_punctate_raise_risk():
    n = _analyze(NoduleSpec(0.7, 0.5, 0.06, 0.09, "VERY_HYPOECHOIC", True, ["PUNCTATE"])).nodules[0]
    assert n.shape == "TALLER_THAN_WIDE"
    assert "PUNCTATE" in n.echogenic_foci
    assert n.tirads_level == 5 and n.risk == "SUSPICIOUS"


def test_no_nodule_warns():
    r = Analyzer(Settings()).analyze([ImageInput(load_image(_png(None)), "TRANSVERSE", 0.06)])
    assert r.nodules == []
    assert any("No nodule" in w for w in r.warnings)


def test_missing_calibration_and_sagittal_warn():
    r = Analyzer(Settings()).analyze([ImageInput(load_image(_png(NoduleSpec(0.3, 0.5, 0.09, 0.07))), "TRANSVERSE", None)])
    text = " ".join(r.warnings)
    assert "calibration" in text and "sagittal" in text


def test_api_analyze_and_validation():
    c = TestClient(app)
    assert c.get("/health").json()["status"] == "ok"
    res = c.post("/v1/analyze", files=[("images", ("t.png", _png(NoduleSpec(0.3, 0.5, 0.09, 0.07)), "image/png"))],
                 data={"meta": '[{"view":"TRANSVERSE","pixel_spacing_mm":0.06}]'})
    assert res.status_code == 200 and res.json()["nodules"][0]["lobe"] == "RIGHT"
    bad = c.post("/v1/analyze", files=[("images", ("x.png", b"not an image", "image/png"))])
    assert bad.status_code == 422
