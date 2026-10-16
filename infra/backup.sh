#!/usr/bin/env bash
# نسخة احتياطية يومية: قاعدة البيانات (pg_dump custom format) + المرفقات (volume uploads)
# في /srv/invoices/backups، ومسح أي نسخة أقدم من 14 يوم.
# الجدولة: deploy.sh بيضيف سطر الـ cron ده لمستخدم invoices-deploy تلقائياً (مرة واحدة، ومن غير تكرار):
#   15 2 * * * bash /srv/invoices/app/infra/backup.sh >> /srv/invoices/backups/backup.log 2>&1 # invoices-backup
#
# بعد كل محاولة بيكتب النتيجة في جدول settings (المفتاح backup.status) — عشان مدير النظام يشوفها
# في الصفحة الرئيسية، والمنظومة تبعتله إيميل لو النسخة اتأخرت أو فشلت.
set -euo pipefail
umask 077

ENV_FILE="${ENV_FILE:-/srv/invoices/.env}"
DEST="${BACKUP_DIR:-/srv/invoices/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
PG_CONTAINER="${PG_CONTAINER:-invoices-postgres-1}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-invoices_uploads}"

env_get() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
PGUSER="$(env_get POSTGRES_USER || true)"; PGUSER="${PGUSER:-invoices}"
PGDB="$(env_get POSTGRES_DB || true)";     PGDB="${PGDB:-invoices}"

# بيدمج الـ JSON في backup.status (الحقول اللي مش مكتوبة — زي okAt من آخر نجاح — بتفضل زي ما هي)
record() {
  docker exec -i "$PG_CONTAINER" psql -q -X -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$PGDB" -v v="$1" >/dev/null <<'SQL' || echo "[$(date -Is)] warn: تعذر تسجيل الحالة في قاعدة البيانات"
INSERT INTO settings (key, value, updated_at) VALUES ('backup.status', :'v'::jsonb, now())
ON CONFLICT (key) DO UPDATE SET value = settings.value || EXCLUDED.value, updated_at = now();
SQL
}

STEP="init"
on_fail() {
  echo "[$(date -Is)] backup FAILED at: $STEP"
  rm -f "${DB_FILE:-}.part" "${UP_FILE:-}.part"
  record "{\"ok\":false,\"at\":\"$(date -Is)\",\"error\":\"$STEP\"}"
}
trap on_fail ERR

mkdir -p "$DEST"
# نسخة واحدة في المرة (الـ cron + أول نسخة بعد الـ deploy ممكن يتقابلوا)
exec 9>"$DEST/.backup.lock"
if ! flock -n 9; then echo "[$(date -Is)] backup already running — skip"; trap - ERR; exit 0; fi
STAMP="$(date +%Y%m%d-%H%M)"
DB_FILE="$DEST/db-$STAMP.dump"
UP_FILE="$DEST/uploads-$STAMP.tar.gz"

echo "[$(date -Is)] backup start"

# pg_dump جوه الـ container (مفيش client على الـ host) — بنكتب لملف مؤقت عشان الملف الناقص مايتعدّش نسخة
STEP="pg_dump"
docker exec "$PG_CONTAINER" pg_dump -U "$PGUSER" -d "$PGDB" -Fc --no-owner > "$DB_FILE.part"

# التحقق: النسخة لازم تتقري وفيها بيانات الجداول (مش بس إن الأمر خلص)
STEP="verify_db"
TABLES="$(docker exec -i "$PG_CONTAINER" pg_restore -l < "$DB_FILE.part" | grep -c 'TABLE DATA' || true)"
[ "${TABLES:-0}" -gt 0 ]
mv "$DB_FILE.part" "$DB_FILE"

UP_BYTES=0
if docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1; then
  STEP="uploads"
  docker run --rm --network none -v "$UPLOADS_VOLUME":/data:ro alpine:3.20 \
    tar -C /data -czf - . > "$UP_FILE.part"
  STEP="verify_uploads"
  gzip -t "$UP_FILE.part"
  mv "$UP_FILE.part" "$UP_FILE"
  UP_BYTES="$(stat -c %s "$UP_FILE")"
fi

STEP="cleanup"
find "$DEST" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'uploads-*.tar.gz' -o -name '*.part' \) \
  -mtime +"$KEEP_DAYS" -delete
COPIES="$(find "$DEST" -maxdepth 1 -type f -name 'db-*.dump' | wc -l)"

NOW="$(date -Is)"
DB_BYTES="$(stat -c %s "$DB_FILE")"
record "{\"ok\":true,\"at\":\"$NOW\",\"okAt\":\"$NOW\",\"error\":null,\"dbBytes\":$DB_BYTES,\"uploadsBytes\":$UP_BYTES,\"tables\":$TABLES,\"copies\":$COPIES,\"file\":\"$(basename "$DB_FILE")\"}"

echo "[$NOW] backup ok: $(du -h "$DB_FILE" | cut -f1) db ($TABLES tables)$( [ -f "$UP_FILE" ] && echo ", $(du -h "$UP_FILE" | cut -f1) uploads"), $COPIES copies kept"
