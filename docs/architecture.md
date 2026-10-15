# معمارية المنظومة — دليل فريق الـ IT

الهدف إن الكود يبقى سهل القراءة وسهل الصيانة. القواعد اللي تحت **إلزامية** في أي كود جديد.

## الطبقات

```
apps/web (Next.js 16 — App Router)
  src/app/                 ← الصفحات والـ layouts بس (رفيعة: بتنادي features)
  src/features/<feature>/  ← كل feature في فولدر لوحده
      *.repo.ts            ← الوصول للداتا (Prisma) — الطبقة الوحيدة اللي بتكلّم DB
      *.service.ts         ← use-cases: بتطبّق القواعد (من @it/domain) والصلاحيات
      *.actions.ts         ← Server Actions / route handlers: validation بـ zod ← service
      *.schema.ts          ← zod schemas مشتركة بين الفورم والسيرفر
      components/          ← UI خاص بالـ feature
  src/components/ui/       ← مكونات عامة (Button, Card, Badge, Table, Field ...)
  src/lib/                 ← أدوات عامة (session, errors, format)

packages/domain            ← منطق الأعمال الصافي — TypeScript من غير DB ولا framework
packages/db                ← Prisma schema + migrations + seed + client
infra/                     ← compose, Dockerfile, scripts للسيرفر
docs/                      ← التوثيق + adr/ (قرار معماري في كل ملف)
```

**اتجاه الاعتماد:** `app → features (actions → service → repo) → @it/db`، و`service → @it/domain`.
- `@it/domain` ما يعتمدش على أي حاجة.
- الصفحة ما تنديش Prisma مباشرة أبداً.

## القواعد

1. **ملف = مسؤولية واحدة.** أي ملف بيعدّي ~250 سطر يتقسم.
2. **النطاق في مكان واحد.** `scopeWhere(user)` في `features/auth` هي اللي بتبني الـ Prisma `where` لكل استعلام على المستخلصات، وكل repo لازم يستخدمها. ممنوع إخفاء البيانات من الواجهة بس.
3. **كل حركة على المستخلص بتعدّي على `transition()`.** دي في `@it/domain` وبتتحقق من القاعدة، والـ service بيسجّل (step_log + audit + notification + email_outbox) جوه transaction واحدة.
4. **التحقق بـ zod** على السيرفر دايماً، حتى لو الفورم اتحقق.
5. **الأخطاء:** `AppError(code, messageAr)`، والواجهة بتعرض الرسالة العربي.
6. **الفلوس `Decimal`** في DB، وبتتحوّل لـ `number` في حدود `@it/domain` بس (تقريب لقرشين). ممنوع `float` في التخزين.
7. **التسمية:**
   - الكود والأعمدة بالإنجليزي، والواجهة والرسايل بالعربي المصري.
   - الجداول `snake_case`، والكود `camelCase`.
8. **التعليقات:** قليلة ومفيدة. التعليق بيشرح "ليه" مش "إيه".
9. **الاختبارات:**
   - كل دالة في `@it/domain` عليها اختبار (vitest).
   - الـ services المهمة (المسار، النطاق) عليها اختبارات integration.
10. **الأسرار:** في `.env` بس (على السيرفر `/srv/invoices/.env`)، ومفيش أي سر في الكود أو الـ repo.

## دورة التطوير

```
تعديل محلي ← git push (GitHub هو المرجع) ← على السيرفر: infra/sync.sh
                                            (npm ci + prisma generate + migrate deploy جوه container)
```

- **قاعدة البيانات:** PostgreSQL 16 في container `invoices-postgres-1`، على `127.0.0.1:5545`، وجوه شبكة `invoices_net`.
- **تشغيل أي أمر Node على السيرفر:** `infra/run.sh <cmd>`، وده بيشغّله جوه `node:22`، فمفيش Node متسطّب على السيرفر.
- **migration جديدة:** `infra/run.sh npx -w @it/db prisma migrate dev --name <name>`. بعدها ملف الـ migration يتسحب للـ repo ويترفع.
