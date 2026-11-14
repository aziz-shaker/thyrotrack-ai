#!/usr/bin/env bash
# Upload the project to the server and (re)start the full stack.
# Usage (from the project root, Git Bash / Linux / macOS):
#   ./deploy/deploy.sh <server-ip> [ssh-user] [--seed]
# First deploy: add --seed to load the fictional demo data + synthetic images.
set -euo pipefail

IP="${1:?usage: deploy.sh <server-ip> [ssh-user] [--seed]}"
USER_="${2:-ubuntu}"
[ "${USER_}" = "--seed" ] && USER_=ubuntu
SEED=0
for a in "$@"; do [ "$a" = "--seed" ] && SEED=1; done

KEY="${SSH_KEY:-$HOME/.ssh/thyrotrack_oracle}"
SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new $USER_@$IP"
DOMAIN="$(echo "$IP" | tr . -).sslip.io"
REMOTE="~/thyrotrack-ai"

echo "==> Packing source (no node_modules, venvs, secrets or local data)"
tar --exclude=node_modules --exclude=.next --exclude=.venv --exclude=__pycache__ --exclude=.pytest_cache \
    --exclude=storage --exclude=backups --exclude=test-results --exclude=playwright-report \
    --exclude='*.env' --exclude='.env' --exclude='web/.env' \
    -czf /tmp/thyrotrack.tgz -C "$(dirname "$0")/.." .

echo "==> Uploading"
scp -i "$KEY" -o StrictHostKeyChecking=accept-new /tmp/thyrotrack.tgz "$USER_@$IP:/tmp/thyrotrack.tgz"

echo "==> Building and starting on $DOMAIN"
$SSH bash -s <<EOF
set -euo pipefail
mkdir -p $REMOTE/storage && cd $REMOTE
tar -xzf /tmp/thyrotrack.tgz && rm /tmp/thyrotrack.tgz

# Production secrets are generated once on the server and never leave it
if [ ! -f .env ]; then
  {
    echo "DOMAIN=$DOMAIN"
    echo "POSTGRES_PASSWORD=\$(openssl rand -hex 24)"
    echo "AI_SERVICE_TOKEN=\$(openssl rand -hex 32)"
  } > .env
  chmod 600 .env
fi
if [ ! -f web/.env ]; then
  {
    echo "NEXTAUTH_URL=https://$DOMAIN"
    echo "NEXTAUTH_SECRET=\$(openssl rand -base64 32)"
    echo "FIELD_ENCRYPTION_KEY=\$(openssl rand -hex 32)"
  } > web/.env
  chmod 600 web/.env
fi

docker compose --profile full up -d --build

if [ "$SEED" = "1" ]; then
  echo "==> Seeding demo data"
  until docker compose exec -T web node -e "1" 2>/dev/null; do sleep 3; done
  sleep 10
  docker compose exec -T web npm run db:seed || true
  # Render the synthetic ultrasound images with the AI image (python lives there)
  docker compose run --rm --user root -v "\$PWD/storage:/data" --entrypoint python ai scripts/make_demo_images.py /data/demo-manifest.json /data
fi
docker compose ps
EOF

echo
echo "Deployed → https://$DOMAIN"
