-- صلاحية تعديل وحذف السجلات: لمدير النظام فقط (تتعدل من شاشة الصلاحيات)
INSERT INTO "role_permissions" ("role", "permission") VALUES ('admin', 'records.manage') ON CONFLICT DO NOTHING;
