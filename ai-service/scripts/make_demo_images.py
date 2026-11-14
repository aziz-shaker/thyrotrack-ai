"""
Render synthetic demo ultrasound images from a manifest written by the web seed.

Usage: python scripts/make_demo_images.py <manifest.json> <storage_dir>
Manifest: [{"key": "demo/xxx.png", "view": "TRANSVERSE", "seed": 1, "nodule": {cx, cy, rx, ry, echo, lobulated, foci}}]
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.synthetic import NoduleSpec, render  # noqa: E402


def main(manifest_path: str, storage_dir: str) -> None:
    items = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    root = Path(storage_dir)
    for it in items:
        n = it.get("nodule")
        spec = NoduleSpec(**n) if n else None
        out = root / it["key"]
        out.parent.mkdir(parents=True, exist_ok=True)
        render(spec, it.get("view", "TRANSVERSE"), seed=it.get("seed", 0)).save(out, optimize=True)
    print(f"rendered {len(items)} images into {root}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
