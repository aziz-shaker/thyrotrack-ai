# ThyroTrack AI — single container for Hugging Face Spaces (web + AI service).
# Playwright base image = Node 20 + Chromium (PDF reports). uid 1000 (pwuser) as Spaces requires.
FROM mcr.microsoft.com/playwright:v1.48.2-jammy

RUN apt-get update && apt-get install -y --no-install-recommends python3-venv python3-pip && rm -rf /var/lib/apt/lists/*

USER pwuser
WORKDIR /home/pwuser/app
ENV NEXT_TELEMETRY_DISABLED=1

# AI service dependencies (cached layer)
COPY --chown=pwuser ai-service/requirements.txt ai-service/requirements.txt
RUN python3 -m venv ai-service/.venv && ai-service/.venv/bin/pip install --no-cache-dir -r ai-service/requirements.txt

# Web dependencies (cached layer)
COPY --chown=pwuser web/package*.json web/
RUN cd web && npm ci

COPY --chown=pwuser . .
RUN cd web && touch .env && npx prisma generate && npm run build

ENV NODE_ENV=production PORT=7860 STORAGE_DRIVER=db AI_SERVICE_URL=http://127.0.0.1:8000
EXPOSE 7860
CMD ["bash", "start.sh"]
