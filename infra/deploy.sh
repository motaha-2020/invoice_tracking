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

# الصور private على GHCR: الـ CI بيبعت GITHUB_TOKEN (صلاحية packages:read، بينتهي مع الـ job) على stdin.
# بنسجّل دخول في DOCKER_CONFIG مؤقت ونمسحه بعد الـ pull — مفيش credentials بتفضل على السيرفر.
GHCR_TOKEN=""
if [[ ! -t 0 ]]; then read -r -t 5 GHCR_TOKEN || true; fi
if [[ -n "$GHCR_TOKEN" ]]; then
  DOCKER_CONFIG="$(mktemp -d)"; export DOCKER_CONFIG
  trap 'rm -rf "$DOCKER_CONFIG"' EXIT
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u motaha-2020 --password-stdin >/dev/null
fi

# جدولة النسخ الاحتياطي اليومي في crontab المستخدم ده (من غير sudo): سطر واحد بعلامة # invoices-backup.
# أي سطر قديم لـ backup.sh (متضاف يدوي) بيتشال عشان مايتكررش. ولو مفيش نسخة خالص، بنعمل أول واحدة في الخلفية.
BACKUP_DIR=/srv/invoices/backups
ensure_backup_cron() {
  command -v crontab >/dev/null || { echo "deploy: crontab مش موجود — جدول backup.sh يدوي" >&2; return 1; }
  local line="15 2 * * * bash $APP_DIR/infra/backup.sh >> $BACKUP_DIR/backup.log 2>&1 # invoices-backup"
  local cur want
  cur="$(crontab -l 2>/dev/null || true)"
  want="$( { grep -vF 'infra/backup.sh' <<<"$cur" || true; echo "$line"; } | sed '/^$/d')"
  if [[ "$cur" != "$want" ]]; then
    printf '%s\n' "$want" | crontab -
    echo "deploy: backup cron مضبوط (يومياً 02:15)"
  fi
  mkdir -p "$BACKUP_DIR"
  if ! compgen -G "$BACKUP_DIR/db-*.dump" >/dev/null; then
    echo "deploy: مفيش نسخة احتياطية لسه — بنعمل أول واحدة في الخلفية"
    env -u DOCKER_CONFIG setsid bash "$APP_DIR/infra/backup.sh" </dev/null >>"$BACKUP_DIR/backup.log" 2>&1 &
  fi
}

echo "deploy: $WEB_IMAGE"
dc --profile deploy pull -q migrate web
if [[ -n "$GHCR_TOKEN" ]]; then docker logout ghcr.io >/dev/null 2>&1 || true; fi
dc --profile deploy run --rm migrate
dc up -d --no-deps web

# نستنى الـ healthcheck (لحد دقيقتين)
for _ in $(seq 1 24); do
  status="$(docker inspect -f '{{.State.Health.Status}}' invoices-web-1 2>/dev/null || echo missing)"
  if [[ "$status" == healthy ]]; then
    echo "deploy: web healthy"
    ensure_backup_cron || echo "deploy: warn — تعذر ضبط جدولة النسخ الاحتياطي (infra/README.md §4)" >&2
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
