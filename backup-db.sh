#!/usr/bin/env sh
# Nightly-style database backup: ./scripts-backup.sh → backups/thyrotrack-YYYYmmdd-HHMM.sql.gz
set -e
mkdir -p backups
docker exec thyrotrack-db pg_dump -U "${POSTGRES_USER:-thyro}" "${POSTGRES_DB:-thyrotrack}" | gzip > "backups/thyrotrack-$(date +%Y%m%d-%H%M).sql.gz"
echo "backup written to backups/"
