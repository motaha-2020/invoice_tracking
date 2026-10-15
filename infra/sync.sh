#!/usr/bin/env bash
# يحدّث نسخة السيرفر من GitHub (GitHub هو المرجع — مفيش تعديل مباشر على السيرفر)
# ثم يسطّب الحزم ويولّد Prisma Client ويطبّق الـ migrations.
set -euo pipefail
cd "$(dirname "$0")/.."
git fetch -q origin main
git reset -q --hard origin/main
infra/run.sh npm ci --no-audit --no-fund --loglevel=error
infra/run.sh npx -w @it/db prisma generate >/dev/null
infra/run.sh npx -w @it/db prisma migrate deploy
git log --oneline -1
