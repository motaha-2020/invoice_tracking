#!/usr/bin/env bash
# يشغّل أمر جوه container فيه Node 22 (من غير ما نسطّب Node على السيرفر)
# الاستخدام:  infra/run.sh npm ci        |  infra/run.sh npm run db:migrate
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-/srv/invoices/.env}"
exec docker run --rm -i \
  --network invoices_net \
  --memory 1536m \
  -v "$APP_DIR":/app -w /app \
  -v invoices_npm_cache:/root/.npm \
  --env-file "$ENV_FILE" \
  -e DATABASE_URL="postgresql://${POSTGRES_USER:-invoices}:$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)@postgres:5432/${POSTGRES_DB:-invoices}" \
  node:22-bookworm "$@"
