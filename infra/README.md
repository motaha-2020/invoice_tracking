# infra — التشغيل على السيرفر

السيرفر Hetzner مشترك (2 vCPU / 3.7 GB): عليه ProjectFlow (PHP + Caddy على الـ host) و n8n (docker على `127.0.0.1:5678`).
المنظومة معزولة تماماً:

| الحاجة | القيمة |
|---|---|
| المكان | `/srv/invoices/app` (checkout من GitHub) و`/srv/invoices/.env` و`/srv/invoices/backups` |
| compose project | `invoices`، والشبكة `invoices_net` |
| Postgres 16 | `invoices-postgres-1` على `127.0.0.1:5545` (512m) |
| web (Next.js) | `invoices-web-1` على `127.0.0.1:3100` (768m)، والمرفقات في volume `invoices_uploads` |
| migrate | one-shot (profile `deploy`): `prisma migrate deploy` + البيانات المرجعية |
| الدومين | `invoices.projectflow.site` ← Caddy على الـ host ← `127.0.0.1:3100` ([caddy/README.md](caddy/README.md)) |
| الصور | `ghcr.io/motaha-2020/invoice_tracking-web` و`-migrate`، بتتبني في GitHub Actions بس |

> **ممنوع بناء Next.js على السيرفر** (الذاكرة مش كفاية). السيرفر بيعمل `pull` بس.

## الملفات

| الملف | الوظيفة |
|---|---|
| `compose.yml` | postgres + migrate + web |
| `deploy.sh` | `git reset` على origin/main، وبعدين pull ← migrate ← `up -d web` ← انتظار الـ healthcheck |
| `backup.sh` | pg_dump + أرشيف المرفقات والتحقق منهم، مع مسح أي نسخة أقدم من 14 يوم، وتسجيل النتيجة في قاعدة البيانات |
| `run.sh` | يشغّل أي أمر Node جوه `node:22` (صيانة / seed / migrate dev) |
| `sync.sh` | تحديث الـ checkout + `npm ci` + migrate (طريقة التطوير القديمة، من غير صور) |
| `caddy/invoices.caddy` | الـ site block (بيتطبق يدوي) |

---

## 1) أول إعداد للسيرفر (مرة واحدة، بـ sudo)

### مستخدم deploy مخصص

```bash
sudo adduser --disabled-password --gecos "" invoices-deploy
sudo usermod -aG docker invoices-deploy          # ملاحظة: جروب docker = صلاحيات root عملياً، والـ forced command تحت هو اللي بيحدّ منها
sudo install -d -o invoices-deploy -g invoices-deploy -m 755 /srv/invoices/app
sudo install -d -o invoices-deploy -g invoices-deploy -m 700 /srv/invoices/backups
# لو الـ checkout موجود بالفعل بمستخدم تاني:
sudo chown -R invoices-deploy:invoices-deploy /srv/invoices/app
```

### ملف البيئة `/srv/invoices/.env`

```bash
sudo touch /srv/invoices/.env
sudo chown root:invoices-deploy /srv/invoices/.env
sudo chmod 640 /srv/invoices/.env
```

المفاتيح (من غير قيم، والقيم عمرها ما تتحط في الـ repo):

| المفتاح | ملاحظة |
|---|---|
| `POSTGRES_USER` | الافتراضي `invoices` |
| `POSTGRES_PASSWORD` | **إلزامي**، ولازم يبقى URL-safe لأنه بيدخل جوه `DATABASE_URL`: `openssl rand -hex 24` |
| `POSTGRES_DB` | الافتراضي `invoices` |
| `APP_URL` | `https://invoices.projectflow.site` (من غير `/` في الآخر) |
| `SESSION_SECRET` | لو الـ web محتاجه: `openssl rand -hex 32` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | بيانات الإيميل |
| `ADMIN_EMAIL` / `ADMIN_NAME` | اختياري هنا. بيتستخدموا مرة واحدة لإنشاء أول Admin (الخطوة 4) |
| `WEB_IMAGE` / `MIGRATE_IMAGE` | اختياري، لتثبيت tag معيّن يدوي (`deploy.sh` بيكتب فوقهم) |

### مفتاح SSH للـ GitHub Actions (forced command)

على جهازك (مش السيرفر):

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions-invoices-deploy" -f invoices_deploy
```

على السيرفر، حط المفتاح العام في `~invoices-deploy/.ssh/authorized_keys` **بالقيود دي**، عشان المفتاح ده مايقدرش يعمل أي حاجة غير `deploy.sh`:

```
restrict,command="bash /srv/invoices/app/infra/deploy.sh" ssh-ed25519 AAAA...  github-actions-invoices-deploy
```

```bash
sudo install -d -o invoices-deploy -g invoices-deploy -m 700 ~invoices-deploy/.ssh
sudo nano ~invoices-deploy/.ssh/authorized_keys
sudo chown invoices-deploy:invoices-deploy ~invoices-deploy/.ssh/authorized_keys
sudo chmod 600 ~invoices-deploy/.ssh/authorized_keys
```

`deploy.sh` بيقبل بس `deploy latest` أو `deploy sha-<hex>`، وأي أمر تاني بيترفض.

### الـ checkout

```bash
sudo -u invoices-deploy git clone https://github.com/motaha-2020/invoice_tracking.git /srv/invoices/app
# Caddy لازم يقدر يقرا الـ snippet:
sudo chmod o+x /srv/invoices
```

### GitHub secrets

Settings ← Secrets and variables ← Actions (أو environment اسمه `production`):

| Secret | القيمة |
|---|---|
| `DEPLOY_HOST` | IP السيرفر أو اسمه |
| `DEPLOY_USER` | `invoices-deploy` |
| `DEPLOY_SSH_KEY` | محتوى الملف الخاص `invoices_deploy` كامل |
| `DEPLOY_KNOWN_HOSTS` | ناتج `ssh-keyscan -t ed25519 <host>`. **قارن** البصمة بـ `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` على السيرفر |

```bash
gh secret set DEPLOY_HOST --body "<host>"
gh secret set DEPLOY_USER --body "invoices-deploy"
gh secret set DEPLOY_SSH_KEY < invoices_deploy
ssh-keyscan -t ed25519 <host> | gh secret set DEPLOY_KNOWN_HOSTS
shred -u invoices_deploy        # بعد ما يترفع
```

لو أي secret من الأربعة ناقص، الـ workflow بيبني الصور ويرفعها، ويتخطى الـ deploy برسالة notice.

### الوصول لصور GHCR

أول مرة الـ workflow يرفع فيها، الـ packages بتتعمل **private** حتى لو الـ repo عام. فيه حلّين:

- **(أ)** من GitHub ← Packages ← `invoice_tracking-web` و`invoice_tracking-migrate` ← Package settings ← Change visibility ← Public. الصور مفيهاش أسرار ولا بيانات حقيقية (`.dockerignore` بيستبعد `Example Data` و`data-import` و`*.pdf`).
- **(ب)** أو تفضل private وتعمل login على السيرفر بـ PAT صلاحيته `read:packages` بس:
  `sudo -u invoices-deploy docker login ghcr.io -u motaha-2020`

### أول تشغيل + أول Admin

```bash
sudo -iu invoices-deploy
cd /srv/invoices/app
bash infra/deploy.sh latest            # pull + migrate + web

# أول Admin (بيطبع توكن الدعوة مرة واحدة — انسخه، وصالح 72 ساعة)
docker compose -p invoices --env-file /srv/invoices/.env -f infra/compose.yml --profile deploy \
  run --rm -e ADMIN_EMAIL="..." -e ADMIN_NAME="..." -e APP_URL="https://invoices.projectflow.site" \
  migrate tsx prisma/seed.ts
```

أو بنفس الطريقة عن طريق `infra/run.sh`، بس محتاج `npm ci` في الـ checkout الأول (`infra/sync.sh` بيعمله):

```bash
infra/run.sh env ADMIN_EMAIL="..." ADMIN_NAME="..." npm run db:seed
```

- لو التوكن ضاع قبل الاستخدام: أعد نفس الأمر وزوّد `-e ADMIN_REISSUE=1`، والتوكن القديم بيتلغي.
- **البيانات التجريبية ممنوعة على الإنتاج.** `SEED_DEMO=1` بيترفض مع `NODE_ENV=production` (اللي متحدد في صورة migrate).
  على بيئة تطوير: `SEED_DEMO=1 SEED_DEMO_PASSWORD=<12+ حرف> npm run db:seed`.

### Caddy + backup cron

- Caddy: [caddy/README.md](caddy/README.md).
- الـ backup cron **بيتضبط لوحده** مع كل deploy (القسم 4). لو `crontab` مش متسطّب على السيرفر (`sudo apt install cron`)، الـ deploy بيكمّل عادي وبيطبع تحذير.

---

## 2) الـ deploy العادي

`git push` على main ← **CI** (typecheck + tests + lint + migrations على Postgres نضيف + seed مرتين) ← **Deploy**:
بيبني الصورتين بـ tag `sha-<7>` و`latest` ← SSH ← `deploy.sh sha-<7>`.

يدوي (من السيرفر أو من Actions ← Deploy ← Run workflow):

```bash
sudo -iu invoices-deploy bash /srv/invoices/app/infra/deploy.sh sha-abc1234
```

المتابعة:

```bash
docker compose -p invoices --env-file /srv/invoices/.env -f /srv/invoices/app/infra/compose.yml ps
docker logs --tail 100 invoices-web-1
curl -fsS http://127.0.0.1:3100/api/health
```

## 3) الرجوع لنسخة قديمة (rollback)

كل deploy ليه tag ثابت `sha-<commit>`. الرجوع معناه نثبّت صورة الـ web على tag قديم:

```bash
# الـ tags المتاحة على السيرفر
docker images ghcr.io/motaha-2020/invoice_tracking-web --format '{{.Tag}}  {{.CreatedSince}}'

cd /srv/invoices/app
WEB_IMAGE=ghcr.io/motaha-2020/invoice_tracking-web:sha-<قديم> \
  docker compose -p invoices --env-file /srv/invoices/.env -f infra/compose.yml up -d --no-deps web
```

أو بشكل دايم لحد ما الإصلاح ينزل: حط `WEB_IMAGE=...:sha-<قديم>` في `/srv/invoices/.env`، وبعدين `up -d web`.
(`deploy.sh` بيكتب فوقها في الـ deploy الجاي.)

**الـ migrations مابترجعش.** الرجوع بيرجّع الكود بس، فأي migration لازم تبقى متوافقة مع النسخة اللي قبلها
(expand ← deploy ← contract): ضيف عمود/جدول الأول، وامسح القديم في release بعدها. ولو migration بايظة:
رجّع الـ backup (تحت) أو اعمل migration تصحيحية جديدة.

## 4) Backup و Restore

### الجدولة (تلقائي)

`deploy.sh` بعد كل deploy ناجح:
- بيتأكد إن crontab بتاع `invoices-deploy` فيه السطر ده بالظبط (وبيشيل أي سطر قديم لـ `backup.sh` اتضاف يدوي عشان مايتكررش):
  ```
  15 2 * * * bash /srv/invoices/app/infra/backup.sh >> /srv/invoices/backups/backup.log 2>&1 # invoices-backup
  ```
  (02:15 بتوقيت السيرفر — لو السيرفر UTC تبقى 04:15 أو 05:15 بتوقيت القاهرة).
- لو مفيش ولا نسخة في `/srv/invoices/backups`، بيعمل أول نسخة في الخلفية على طول.

للتأكد يدوي: `sudo crontab -u invoices-deploy -l` و`tail /srv/invoices/backups/backup.log`.

### كل نسخة

`backup.sh` بيعمل:
- `db-YYYYMMDD-HHMM.dump`: pg_dump بصيغة custom، **وبيتحقق منها** بـ `pg_restore -l` (لازم تقرا وفيها بيانات الجداول).
- `uploads-YYYYMMDD-HHMM.tar.gz`: المرفقات، **وبيتحقق منها** بـ `gzip -t`.

وبيمسح أي حاجة أقدم من 14 يوم (`KEEP_DAYS`). الملف بيتكتب `.part` الأول، فالنسخة الناقصة عمرها ما تتعدّ نسخة.

### المتابعة من جوه المنظومة

بعد كل محاولة، `backup.sh` بيكتب النتيجة في `settings` (المفتاح `backup.status`): الوقت، والحجم، وعدد النسخ، والخطوة اللي فشلت لو فيه فشل.
- **مدير النظام** بيشوف الحالة في الصفحة الرئيسية: تعمل / فشلت / متأخرة / لم تُسجَّل بعد.
- لو آخر محاولة **فشلت**، أو آخر نسخة ناجحة **أقدم من 30 ساعة**، المنظومة بتبعت إيميل تنبيه لمديري النظام (مرة واحدة في اليوم، بعد 9 الصبح بتوقيت القاهرة). **انسخهم برا السيرفر كمان** (Hetzner Storage Box / rclone)، لأن النسخة على نفس الديسك مش backup حقيقي.

Restore:

```bash
cd /srv/invoices/app
DC="docker compose -p invoices --env-file /srv/invoices/.env -f infra/compose.yml"
$DC stop web

# قاعدة البيانات (بتمسح وتعيد إنشاء الجداول من النسخة)
docker exec -i invoices-postgres-1 pg_restore -U invoices -d invoices --clean --if-exists --no-owner \
  < /srv/invoices/backups/db-YYYYMMDD-HHMM.dump

# المرفقات
docker run --rm -v invoices_uploads:/data -v /srv/invoices/backups:/b:ro alpine:3.20 \
  sh -c 'cd /data && tar -xzf /b/uploads-YYYYMMDD-HHMM.tar.gz'

$DC up -d web
```

جرّب الـ restore كل فترة على DB منفصلة: `createdb` جوه الـ container، و`pg_restore -d <test_db>`.
