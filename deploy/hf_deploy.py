"""
Deploy ThyroTrack to Hugging Face Spaces (web + AI in one Docker container) with Neon Postgres.

  python deploy/hf_deploy.py            # create/update the Space, set secrets, upload code
Reads deploy/secrets.env (NEON_DATABASE_URL, HF_TOKEN). Production secrets (NextAuth, field
encryption key, AI token) are generated once and kept in deploy/.prod.env (git-ignored) so the
same keys are used for seeding and for the running app.
"""
from __future__ import annotations

import secrets
import shutil
import sys
import tempfile
from base64 import b64encode
from pathlib import Path

from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parents[1]
SPACE_NAME = "thyrotrack-ai"


def read_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip().strip("\"").strip("'")
    return out


def main() -> None:
    cfg = read_env(ROOT / "deploy/secrets.env")
    token, db_url = cfg.get("HF_TOKEN", ""), cfg.get("NEON_DATABASE_URL", "")
    if not token.startswith("hf_") or not db_url.startswith("postgres"):
        sys.exit("Fill HF_TOKEN and NEON_DATABASE_URL in deploy/secrets.env first.")

    api = HfApi(token=token)
    user = api.whoami()["name"]
    repo_id = f"{user}/{SPACE_NAME}"
    host = f"{user}-{SPACE_NAME}".lower().replace("_", "-").replace(".", "-")
    url = f"https://{host}.hf.space"

    prod_path = ROOT / "deploy/.prod.env"
    prod = read_env(prod_path)
    prod.setdefault("NEXTAUTH_SECRET", b64encode(secrets.token_bytes(32)).decode())
    prod.setdefault("FIELD_ENCRYPTION_KEY", secrets.token_hex(32))
    prod.setdefault("AI_SERVICE_TOKEN", secrets.token_hex(32))
    prod["NEXTAUTH_URL"] = url
    prod["DATABASE_URL"] = db_url
    prod_path.write_text("".join(f"{k}={v}\n" for k, v in prod.items()), encoding="utf-8")

    print(f"Space: {repo_id}  →  {url}")
    api.create_repo(repo_id, repo_type="space", space_sdk="docker", exist_ok=True, private=False)
    for k in ("DATABASE_URL", "NEXTAUTH_SECRET", "FIELD_ENCRYPTION_KEY", "AI_SERVICE_TOKEN", "NEXTAUTH_URL"):
        api.add_space_secret(repo_id, k, prod[k])

    # Stage only what the image needs (no node_modules, venvs, secrets, local data)
    with tempfile.TemporaryDirectory() as tmp:
        stage = Path(tmp)
        ignore = shutil.ignore_patterns(
            "node_modules", ".next", ".venv", "__pycache__", ".pytest_cache", "test-results", "playwright-report",
            ".env", "*.env", "storage", "tests", "Dockerfile", ".dockerignore",
        )
        shutil.copytree(ROOT / "web", stage / "web", ignore=ignore)
        shutil.copytree(ROOT / "ai-service", stage / "ai-service", ignore=ignore)
        for f in ("Dockerfile", "start.sh", "README.md"):
            shutil.copy(ROOT / "deploy/space" / f, stage / f)
        api.upload_folder(repo_id=repo_id, repo_type="space", folder_path=str(stage), commit_message="Deploy ThyroTrack AI")

    print(f"Uploaded. Build logs: https://huggingface.co/spaces/{repo_id}?logs=build")
    print(f"App URL (after build): {url}")


if __name__ == "__main__":
    main()
