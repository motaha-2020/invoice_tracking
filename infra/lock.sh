#!/usr/bin/env bash
# يعيد توليد package-lock.json على Linux (السيرفر) — عشان الـ lockfile يحتوي الحزم الخاصة بـ Linux
# (lockfile متولّد على ويندوز بيفوّت binaries زي lightningcss-linux-x64-gnu).
# الاستخدام على السيرفر:  infra/lock.sh  ← بعدها انسخ package-lock.json للـ repo وارفعه.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf node_modules apps/*/node_modules packages/*/node_modules package-lock.json
infra/run.sh npm install --no-audit --no-fund --loglevel=error
echo "lockfile: $(wc -c < package-lock.json) bytes"
