"""
Deploy ThyroTrack to Vercel (free Hobby plan): AI service (Python) + web app (Next.js), database on Neon.

  python deploy/vercel_deploy.py [ai|web|all]

Reads deploy/.prod.env (DATABASE_URL, NEXTAUTH_SECRET, FIELD_ENCRYPTION_KEY, AI_SERVICE_TOKEN, VERCEL_TOKEN).
Each part is staged into a clean temp folder (no node_modules, venvs, secrets) and deployed with the Vercel CLI.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLI = "npx --yes vercel@latest"  # Vercel API rejects old CLI versions
AI_PROJECT, WEB_PROJECT = "thyrotrack-ai-service", "thyrotrack-ai"


def load_env() -> dict[str, str]:
    env = {}
    for line in (ROOT / "deploy/.prod.env").read_text(encoding="utf-8").splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            env[k] = v
    return env


ENV = load_env()
TOKEN = ENV["VERCEL_TOKEN"]


def run(cmd: str, cwd: Path, stdin: str | None = None, check: bool = True) -> str:
    p = subprocess.run(f"{cmd} --token {TOKEN}", cwd=cwd, shell=True, input=stdin, capture_output=True, text=True, encoding="utf-8")
    out = (p.stdout or "") + (p.stderr or "")
    if check and p.returncode != 0:
        print(out.replace(TOKEN, "***"))
        sys.exit(f"command failed: {cmd}")
    return out


def set_env(cwd: Path, name: str, value: str) -> None:
    # Value goes through stdin (never on the command line); --force overwrites on redeploys
    run(f"{CLI} env add {name} --environment production --force --sensitive --yes", cwd, stdin=value)


def deploy(stage: Path, project: str, env: dict[str, str]) -> str:
    run(f"{CLI} link --yes --project {project}", stage)
    for k, v in env.items():
        set_env(stage, k, v)
    out = run(f"{CLI} deploy --prod --yes", stage)
    # Per-deployment URLs are behind Vercel Authentication; the production alias is public and stable
    alias = f"https://{project}.vercel.app"
    print(f"  deployed {project}: {alias}")
    return alias


def stage_copy(src: Path, dst: Path, extra_ignore: tuple[str, ...] = ()) -> None:
    shutil.copytree(
        src,
        dst,
        ignore=shutil.ignore_patterns(
            "node_modules", ".next", ".venv", "__pycache__", ".pytest_cache", "test-results", "playwright-report",
            ".env", "*.env", ".vercel", "storage", "tests", "Dockerfile", ".dockerignore", *extra_ignore,
        ),
    )


def deploy_ai() -> str:
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        stage = Path(tmp) / "ai"
        stage_copy(ROOT / "ai-service", stage, ("scripts", "requirements.txt", "requirements-vercel.txt"))
        shutil.copy(ROOT / "ai-service/requirements-vercel.txt", stage / "requirements.txt")  # slim, no test deps
        print("Deploying AI service…")
        return deploy(stage, AI_PROJECT, {"SERVICE_TOKEN": ENV["AI_SERVICE_TOKEN"]})


def deploy_web(ai_url: str) -> str:
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        stage = Path(tmp) / "web"
        stage_copy(ROOT / "web", stage)
        print("Deploying web app…")
        return deploy(
            stage,
            WEB_PROJECT,
            {
                "DATABASE_URL": ENV["DATABASE_URL"],
                "NEXTAUTH_SECRET": ENV["NEXTAUTH_SECRET"],
                "FIELD_ENCRYPTION_KEY": ENV["FIELD_ENCRYPTION_KEY"],
                "AI_SERVICE_TOKEN": ENV["AI_SERVICE_TOKEN"],
                "AI_SERVICE_URL": ai_url,
                "STORAGE_DRIVER": "db",
            },
        )


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    ai_url = ENV.get("AI_URL", "")
    if what in ("ai", "all"):
        ai_url = deploy_ai()
        with open(ROOT / "deploy/.prod.env", "a", encoding="utf-8") as f:
            f.write(f"AI_URL={ai_url}\n")
    if what in ("web", "all"):
        if not ai_url:
            sys.exit("AI_URL unknown — deploy the AI service first")
        web = deploy_web(ai_url)
        print(f"\nThyroTrack is live: {web}")
