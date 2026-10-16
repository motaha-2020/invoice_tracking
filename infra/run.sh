#!/usr/bin/env bash
# يشغّل أمر جوه container فيه Node 22 (من غير ما نسطّب Node على السيرفر)
# الاستخدام:  infra/run.sh npm ci        |  infra/run.sh npm run db:migrate
# WITH_UPLOADS=1 ← يربط volume المرفقات بتاع الـ web ويشغّل كمستخدم node (نفس مالك الملفات في الـ web)
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-/srv/invoices/.env}"
EXTRA=()
if [[ "${WITH_UPLOADS:-0}" == 1 ]]; then
  EXTRA=(-v invoices_uploads:/data/uploads -e UPLOAD_DIR=/data/uploads --user 1000:1000 -e HOME=/tmp -e npm_config_cache=/tmp/.npm)
fi
exec docker run --rm -i "${EXTRA[@]}" \
  --network invoices_net \
  --memory 1536m \
  -v "$APP_DIR":/app -w /app \
  -v invoices_npm_cache:/root/.npm \
  --env-file "$ENV_FILE" \
  -e DATABASE_URL="postgresql://${POSTGRES_USER:-invoices}:$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)@postgres:5432/${POSTGRES_DB:-invoices}" \
  node:22-bookworm "$@"
