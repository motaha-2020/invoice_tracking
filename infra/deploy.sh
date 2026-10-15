#!/usr/bin/env bash
# الـ deploy على السيرفر — بيتنادى من GitHub Actions عن طريق SSH (forced command في authorized_keys)
# أو يدوي:  infra/deploy.sh [tag]      (tag = sha-xxxxxxx أو latest — الافتراضي latest)
#
# 1) يحدّث /srv/invoices/app من origin/main (عشان compose.yml وغيره يبقوا بنفس نسخة الصورة)
# 2) يعيد تشغيل نسخته الجديدة (بعد الـ reset) للخطوات الباقية
# 3) pull للصور ← migrate (one-shot) ← up -d web
#
# الكود كله جوه { } عشان bash يقرا الملف كله قبل التنفيذ — git reset بيكتب فوق الملف ده وهو شغال.
{
set -euo pipefail

APP_DIR=/srv/invoices/app
ENV_FILE=/srv/invoices/.env
REGISTRY=ghcr.io/motaha-2020

# الـ tag من الـ argument، أو من SSH_ORIGINAL_COMMAND ("deploy sha-abc1234") لو مفيش arguments
# (الـ arguments الأول عشان الـ exec بتاع --after-sync يكسب على SSH_ORIGINAL_COMMAND اللي لسه في الـ env)
REQ="${*:-${SSH_ORIGINAL_COMMAND:-}}"
REQ="${REQ#deploy }"
AFTER_SYNC=0
if [[ "$REQ" == --after-sync* ]]; then AFTER_SYNC=1; REQ="${REQ#--after-sync}"; REQ="${REQ# }"; fi
TAG="${REQ:-latest}"
if [[ ! "$TAG" =~ ^(latest|sha-[0-9a-f]{7,40})$ ]]; then
  echo "deploy: tag مرفوض: '$TAG' (المسموح: latest أو sha-<hex>)" >&2
  exit 2
fi

cd "$APP_DIR"

if [[ "$AFTER_SYNC" -eq 0 ]]; then
  git fetch -q origin main
  git reset -q --hard origin/main
  echo "deploy: الكود على $(git log --oneline -1)"
  exec bash "$APP_DIR/infra/deploy.sh" --after-sync "$TAG"
fi

export WEB_IMAGE="$REGISTRY/invoice_tracking-web:$TAG"
export MIGRATE_IMAGE="$REGISTRY/invoice_tracking-migrate:$TAG"
dc() { docker compose -p invoices --env-file "$ENV_FILE" -f infra/compose.yml "$@"; }

echo "deploy: $WEB_IMAGE"
dc --profile deploy pull -q migrate web
dc --profile deploy run --rm migrate
dc up -d --no-deps web

# نستنى الـ healthcheck (لحد دقيقتين)
for _ in $(seq 1 24); do
  status="$(docker inspect -f '{{.State.Health.Status}}' invoices-web-1 2>/dev/null || echo missing)"
  if [[ "$status" == healthy ]]; then
    echo "deploy: web healthy"
    # صورنا القديمة بس (السيرفر مشترك — مانلمسش صور n8n أو غيره)
    docker image prune -f --filter "until=168h" \
      --filter "label=org.opencontainers.image.source=https://github.com/motaha-2020/invoice_tracking" >/dev/null || true
    exit 0
  fi
  sleep 5
done
echo "deploy: web مش healthy بعد دقيقتين (status=$status) — شوف: docker logs invoices-web-1" >&2
exit 1
}
