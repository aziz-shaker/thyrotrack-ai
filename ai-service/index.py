"""Vercel entrypoint (zero-config FastAPI): Vercel detects the `app` instance in this file."""
from app.main import app  # noqa: F401
