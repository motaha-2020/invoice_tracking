# ADR 0002 — الدخول والجلسات والنطاق

- **الحالة:** معتمد
- **التاريخ:** 2026-10-15

## السياق

- المستخدمين عشرات (شركات + إدارات)، وكل واحد ليه دور أو أكتر، وكل دور بنطاق (all / شركة / رئاسة / قطاع / إدارة عامة / إدارة / سنترال).
- مفيش تسجيل ذاتي: الأدمن بيعمل الحساب ويبعت دعوة.
- Next.js 16 بـ Cache Components: أي قراءة للكوكيز لازم تبقى جوه `<Suspense>`، والكوكيز ما تتكتبش وقت الـ render.
- الـ `middleware` اتسمى `proxy` في Next 16، والدوكس بتقول ما نعتمدش عليه لوحده في الحماية.

## القرار

1. **جلسات في DB، من غير مكتبة auth خارجية.**
   - التوكن 32 byte عشوائي (`base64url`) في كوكي `it_session`: `httpOnly`، `sameSite=lax`، `secure` في الـ production
     (`COOKIE_SECURE=false` يقفله لو السيرفر لسه على http).
   - الـ DB بيخزن `sha256(token)` بس كـ `Session.id` — تسريب الجدول ما يدّيش جلسات شغالة.
   - الصلاحية 12 ساعة sliding: الـ proxy بيجدد عمر الكوكي مع كل GET، و`getCurrentUser` بيمد `expiresAt` في DB (بحد أقصى مرة كل 10 دقايق).
   - الخروج بيمسح الصف من DB والكوكي. ضبط كلمة سر من دعوة بيمسح كل جلسات المستخدم.
2. **كلمات السر argon2id** (`@node-rs/argon2`، 19 MiB / 2 iterations — إعدادات OWASP). الحد الأدنى 10 حروف.
3. **الدخول:** zod على السيرفر، رسالة خطأ واحدة لكل الحالات، verify على hash وهمي لو المستخدم مش موجود (توقيت متقارب)،
   و rate limit في الذاكرة: 5 محاولات غلط لكل إيميل و20 لكل IP في 15 دقيقة. كل دخول/فشل بيتسجل في `audit_log`.
4. **الدعوات:** توكن عشوائي، `InviteToken.id = sha256(token)`، صالح 72 ساعة ولمرة واحدة (الاستهلاك `updateMany ... where usedAt is null`
   جوه transaction). الإيميل بيتكتب في `email_outbox` (pending) — الإرسال الفعلي شغل الـ worker بعدين.
5. **الحماية على 3 طبقات:**
   - `proxy.ts`: فحص وجود الكوكي بس (من غير DB) ← تحويل لـ `/login?next=`.
   - `requireUser / requireRole / requirePermission / requireNavAccess` في كل صفحة و Server Action (403 بـ `forbidden()`).
   - **النطاق في الاستعلام نفسه:** `scopeWhere` / `visibleInvoicesWhere` / `inboxWhere` في `features/auth/scope.ts` — دوال صافية
     بتبني Prisma `where`، وعليها اختبارات vitest. مفيش repo بيقرا مستخلصات من غيرها.
6. **الصلاحيات الإضافية** من جدول `role_permissions`، ولو الجدول فاضي fallback للـ defaults (نفس الديمو) في `permission-rules.ts`.

## البدائل اللي اترفضت

- **Auth.js / Lucia / Clerk:** طبقة زيادة لمتطلبات بسيطة (إيميل + كلمة سر + دعوات)، وClerk خدمة برا السيرفر.
- **JWT في الكوكي (stateless):** ما ينفعش نلغي جلسة فوراً (إيقاف مستخدم، تغيير كلمة سر) من غير blacklist في DB أصلاً.
- **التحقق في الـ proxy بس:** Server Actions بتعدّي من الـ matcher بطرق مش واضحة، والدوكس بتنصح بالتحقق جنب الداتا.

## العواقب

- الـ rate limit في الذاكرة بيشتغل صح على instance واحد بس؛ لو بقى فيه أكتر يتنقل لـ Postgres.
- كل صفحة محمية لازم محتواها يبقى جوه `<Suspense>` (Cache Components) — الـ shell نفسه static.
- منطق `inScope/canAct` الصافي هيتنقل لـ `@it/domain`؛ `scope.ts` يفضل المترجم لـ Prisma `where`.
