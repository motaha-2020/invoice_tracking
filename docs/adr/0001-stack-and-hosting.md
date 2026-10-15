# ADR 0001 — الـ stack والاستضافة

- **الحالة:** معتمد
- **التاريخ:** 2026-10-15

## السياق

- المنظومة داخلية لمستخدمين محدودين: شركات منفذة وإدارات المصرية للاتصالات، يعني عشرات المستخدمين مش آلاف.
- البيانات علائقية بامتياز، وفيها فلوس محتاجة دقة:
  عقود ← بنود ← أوامر تكليف ← مستخلصات ← نسخ ← بنود ومهمات، مع مسار ونطاق صلاحيات.
- الاستضافة المتاحة سيرفر Hetzner واحد صغير (2 vCPU / 3.7 GB)، وعليه بالفعل ProjectFlow (PHP + Caddy على الـ host) و n8n.
- الفريق صغير، فمحتاجين أقل عدد من اللغات والأدوات.

## القرار

1. **Next.js (App Router) + TypeScript** للواجهة والسيرفر في تطبيق واحد.
   Server Actions و route handlers بدل API منفصل، ولغة واحدة من أول الـ DB لحد الواجهة. والمنطق الصافي
   في `@it/domain` من غير framework، عشان يتختبر لوحده.
2. **PostgreSQL 16 + Prisma 7**.
   - Postgres: علاقات وقيود حقيقية، و`numeric` للفلوس (`Decimal(18,2)`)، وtransactions للانتقالات.
   - Prisma: schema واحدة بتولّد types، وmigrations متسجلة في git، و`migrate deploy` آمن على الإنتاج.
     والـ driver adapter (`@prisma/adapter-pg`) معناه مفيش engine binary في صورة الـ web.
3. **البناء في GitHub Actions بس، والسيرفر بيعمل pull للصور من GHCR.**
   `next build` بياكل ذاكرة ومعالج كتير، ولو اشتغل على السيرفر المشترك ممكن يوقّع ProjectFlow و n8n.
   كمان الصورة اللي اتختبرت في CI هي نفسها اللي بتشتغل (tag `sha-<commit>`)، وده بيخلّي الرجوع لنسخة قديمة مجرد تغيير tag.
4. **Docker Compose معزول على السيرفر المشترك**: project `invoices`، وشبكة `invoices_net`، والبورتات على `127.0.0.1` بس،
   و`mem_limit` لكل خدمة (postgres 512m، web 768m). كده المنظومة ماتقدرش تاخد موارد جيرانها، ولا تتكشف على الإنترنت
   غير عن طريق الـ reverse proxy. وكل حاجة تبعنا في `/srv/invoices`، فالمسح أو النقل لسيرفر تاني سهل.
5. **Caddy اللي على الـ host هو الـ reverse proxy** (snippet بـ `import`)، مش container Caddy تاني.
   - بورت 80/443 واحد بس على السيرفر، وCaddy ماسكه بالفعل لـ ProjectFlow.
   - الشهادات (Let's Encrypt) والـ headers واللوجات في مكان واحد.
   - التعديل يدوي (`caddy validate` ← `reload`) عشان أي commit ما يوقعش موقع تاني.

## البدائل اللي اترفضت

- **Laravel/PHP زي ProjectFlow:** كان هيوحّد مع الموجود، بس هيفصل منطق الواجهة عن السيرفر في لغتين، وتجربة الـ typing للفلوس والمسار أضعف.
- **SQLite:** أخف، بس مفيهوش concurrency كتابة كويس ولا `numeric` حقيقي. والنقل لـ Postgres بعدين أغلى من البداية بيه.
- **البناء على السيرفر (`infra/sync.sh` + `next build`):** أبسط، بس خطر على الذاكرة المشتركة، ومفيش artifact ثابت نرجع له.
- **Vercel / managed DB:** تكلفة وتوزيع بيانات حكومية/تعاقدية برا السيرفر المتفق عليه.

## العواقب

- محتاجين secrets في GitHub (SSH deploy key مقيّد بـ forced command) ووصول لـ GHCR.
- الـ migrations لازم تبقى backward-compatible (expand/contract)، لأن الرجوع بيرجّع الكود بس، مش الـ schema.
- أي تغيير في Caddy خطوة يدوية مقصودة.
- لو الحمل كبر، الـ web يتنقل لسيرفر تاني من غير تغيير في الكود: نفس الصورة، ونغيّر `DATABASE_URL` بس.
