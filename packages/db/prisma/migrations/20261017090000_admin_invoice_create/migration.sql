-- مدير النظام يقدر يقدّم مستخلص نيابةً عن المقاول.
-- على التثبيتات الموجودة بس (الصلاحية ليها صفوف بالفعل) — في قاعدة جديدة الـ seed بيضيف القيم الافتراضية كاملة،
-- ولو الصف اتضاف هنا قبله كان الـ seed هيتخطى الصلاحية ويسيب المقاول من غيرها.
INSERT INTO "role_permissions" ("role", "permission")
SELECT 'admin', 'invoice.create'
WHERE EXISTS (SELECT 1 FROM "role_permissions" WHERE "permission" = 'invoice.create')
ON CONFLICT DO NOTHING;
