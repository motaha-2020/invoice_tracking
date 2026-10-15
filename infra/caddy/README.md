# Caddy — إضافة invoices.projectflow.site بأمان

Caddy متسطّب على الـ host وبيخدم ProjectFlow (`app.projectflow.site`). إحنا **مش** بنعدّل الـ block بتاعه.
كل اللي بنعمله سطر `import` واحد للـ snippet اللي في الـ repo: `infra/caddy/invoices.caddy`.

## قبل ما تبدأ

- الـ DNS: سجل `A` لـ `invoices.projectflow.site` على IP السيرفر، ويكون اتنشر (`dig +short invoices.projectflow.site`).
  من غيره Caddy مش هيعرف يطلّع شهادة Let's Encrypt.
- الـ container `invoices-web-1` شغال على `127.0.0.1:3100`:
  `curl -fsS http://127.0.0.1:3100/api/health`
- فولدر اللوج موجود وملك caddy:
  `sudo install -d -o caddy -g caddy /var/log/caddy`

## خطوات التطبيق

```bash
# 1) نسخة احتياطية بتاريخ
sudo cp -a /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%F-%H%M)

# 2) سطر import واحد في آخر الملف (برا أي block)
echo 'import /srv/invoices/app/infra/caddy/invoices.caddy' | sudo tee -a /etc/caddy/Caddyfile

# 3) التحقق قبل أي reload — لو فيه خطأ، ماتكمّلش
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

# 4) reload من غير downtime (لو الـ config غلط، Caddy بيفضل على القديم)
sudo systemctl reload caddy

# 5) التأكد
sudo systemctl status caddy --no-pager | head -5
curl -fsSI https://invoices.projectflow.site/api/health
curl -fsSI https://app.projectflow.site | head -1      # ProjectFlow لسه شغال
```

`caddy` لازم يقدر يقرا الـ snippet: `/srv/invoices/app` لازم يكون قابل للقراءة لأي حد (`o+rx` على الفولدرات و`o+r` على الملف).
اختبره كده: `sudo -u caddy cat /srv/invoices/app/infra/caddy/invoices.caddy`.

## الرجوع (rollback)

```bash
sudo cp -a /etc/caddy/Caddyfile.bak.<التاريخ> /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

## ملاحظات

- أي تعديل على `invoices.caddy` بيوصل للسيرفر مع `git reset` في الـ deploy، بس **مش بيتطبق** غير بعد
  `caddy validate` + `systemctl reload caddy` يدوي. ده مقصود، عشان أي commit ما يوقعش ProjectFlow.
- الـ headers هنا اتكتبت من غير ما نشوف الـ block بتاع ProjectFlow، فقارنهم بيه قبل التطبيق. لو الـ block بتاعه فيه `Content-Security-Policy`، اتفقوا عليه
  مع فريق الـ web الأول قبل ما يتضاف هنا، لأن Next.js محتاج inline scripts.
