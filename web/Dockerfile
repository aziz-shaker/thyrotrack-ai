# Playwright base image ships Node + Chromium (used for PDF report rendering)
FROM mcr.microsoft.com/playwright:v1.48.2-jammy
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm ci
# seed script loads .env if present; env vars come from compose in containers
RUN touch .env
COPY . .
RUN npx prisma generate && npm run build
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
# Apply pending migrations, then start
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
