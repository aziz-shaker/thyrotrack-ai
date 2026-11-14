#!/usr/bin/env bash
# Start the AI service (internal only) and the web app (public, port 7860).
set -euo pipefail
export SERVICE_TOKEN="${AI_SERVICE_TOKEN:-}"

cd /home/pwuser/app/ai-service
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &

cd /home/pwuser/app/web
npx prisma migrate deploy
exec npx next start -H 0.0.0.0 -p 7860
