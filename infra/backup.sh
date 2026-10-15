#!/usr/bin/env bash
# نسخة احتياطية يومية: قاعدة البيانات (pg_dump custom format) + المرفقات (volume uploads)
# في /srv/invoices/backups، ومسح أي نسخة أقدم من 14 يوم.
# cron (كـ invoices-deploy):
#   15 2 * * * /srv/invoices/app/infra/backup.sh >> /srv/invoices/backups/backup.log 2>&1
set -euo pipefail
umask 077

ENV_FILE="${ENV_FILE:-/srv/invoices/.env}"
DEST="${BACKUP_DIR:-/srv/invoices/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
PG_CONTAINER="${PG_CONTAINER:-invoices-postgres-1}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-invoices_uploads}"

env_get() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
PGUSER="$(env_get POSTGRES_USER)"; PGUSER="${PGUSER:-invoices}"
PGDB="$(env_get POSTGRES_DB)";     PGDB="${PGDB:-invoices}"

mkdir -p "$DEST"
STAMP="$(date +%Y%m%d-%H%M)"
DB_FILE="$DEST/db-$STAMP.dump"
UP_FILE="$DEST/uploads-$STAMP.tar.gz"

echo "[$(date -Is)] backup start"

# pg_dump جوه الـ container (مفيش client على الـ host) — بنكتب لملف مؤقت عشان الملف الناقص مايتعدّش نسخة
docker exec "$PG_CONTAINER" pg_dump -U "$PGUSER" -d "$PGDB" -Fc --no-owner > "$DB_FILE.part"
mv "$DB_FILE.part" "$DB_FILE"

if docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1; then
  docker run --rm --network none -v "$UPLOADS_VOLUME":/data:ro alpine:3.20 \
    tar -C /data -czf - . > "$UP_FILE.part"
  mv "$UP_FILE.part" "$UP_FILE"
fi

find "$DEST" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'uploads-*.tar.gz' -o -name '*.part' \) \
  -mtime +"$KEEP_DAYS" -delete

echo "[$(date -Is)] backup ok: $(du -h "$DB_FILE" | cut -f1) db$( [ -f "$UP_FILE" ] && echo ", $(du -h "$UP_FILE" | cut -f1) uploads")"
