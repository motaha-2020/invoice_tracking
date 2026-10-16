-- مدير النظام يقدر يقدّم مستخلص نيابةً عن المقاول
INSERT INTO "role_permissions" ("role", "permission") VALUES ('admin', 'invoice.create') ON CONFLICT DO NOTHING;
