import "server-only";
import { isExampleRow, required, text } from "@/features/imports/cells";
import type { Importer, ImportPreview, RowResult } from "@/features/imports/import.types";
import { registerImporter } from "@/features/imports/registry";
import { ROLE_LABELS, SCOPE_TYPE_LABELS } from "@/lib/labels";
import { emailsExist, findUsersByEmails, listScopeOptions, upsertImportedUser } from "./users.repo";
import {
  buildScopeLookup,
  defaultScopeType,
  groupImportRows,
  isEmail,
  normalizeEmail,
  parseRole,
  parseScopeType,
  resolveScopeCode,
  roleScopeKey,
  type ImportUserRow,
} from "./users.rules";

/**
 * قالب 04 المستخدمين: كل صف = (مستخدم + دور + نطاق). نفس الإيميل في أكتر من صف = أكتر من نطاق.
 * المستخدمين بيتعملوا من غير كلمة سر، والدعوات ما بتتبعتش هنا — زرار "ابعت دعوات للجداد" بعد الحفظ.
 */
const SHEET = "المستخدمين";

const importer: Importer<ImportUserRow> = {
  templateId: "04_المستخدمين",
  title: "المستخدمون والصلاحيات",
  templateFile: "04_المستخدمين.xlsx",
  permission: "users.manage",
  sheets: [{ name: SHEET, kind: "table" }],

  async validate(wb) {
    const sheet = wb.sheets[SHEET];
    const raw = sheet?.kind === "table" ? sheet.rows.filter((r) => !isExampleRow(r)) : [];
    const emails = [...new Set(raw.map((r) => normalizeEmail(r.email)).filter(isEmail))];
    const delegates = [...new Set(raw.map((r) => normalizeEmail(r.delegate_email)).filter(isEmail))];
    const [options, existing, delegatesInDb] = await Promise.all([
      listScopeOptions(),
      emails.length ? findUsersByEmails(emails) : [],
      delegates.length ? emailsExist(delegates) : [],
    ]);
    const lookup = buildScopeLookup(options);
    const existingByEmail = new Map(existing.map((u) => [u.email, new Set(u.roles.map(roleScopeKey))]));
    const knownDelegates = new Set([...emails, ...delegatesInDb.map((d) => d.email)]);

    const firstName = new Map<string, string>();
    const seen = new Set<string>();
    const rows: RowResult<ImportUserRow>[] = [];

    for (const r of raw) {
      const errors: string[] = [];
      const warnings: string[] = [];
      const name = required(r.name, "الاسم");
      if (name.error) errors.push(name.error);
      const email = normalizeEmail(r.email);
      if (!email) errors.push("البريد الإلكتروني إلزامي");
      else if (!isEmail(email)) errors.push(`البريد الإلكتروني "${text(r.email)}" بصيغة غير صحيحة`);

      const role = parseRole(r.role);
      if (!role) errors.push(text(r.role) ? `الدور الوظيفي "${text(r.role)}" غير معروف` : "الدور الوظيفي إلزامي");

      let scopeType = parseScopeType(r.scope_type);
      if (!scopeType && text(r.scope_type)) errors.push(`نوع نطاق الصلاحية "${text(r.scope_type)}" غير معروف`);
      if (!scopeType && role && !text(r.scope_type)) {
        scopeType = defaultScopeType(role);
        warnings.push(`نوع نطاق الصلاحية غير مُدخل — تم تعيين النطاق المعتاد للدور (${SCOPE_TYPE_LABELS[scopeType]})`);
      }

      let scopeId: string | null = null;
      let scopeName = "جميع الجهات";
      if (scopeType) {
        const res = resolveScopeCode(lookup, scopeType, text(r.scope_code));
        if (res.error) errors.push(res.error);
        else if (res.value) {
          scopeId = res.value.id;
          scopeName = res.value.name;
        } else if (text(r.scope_code)) warnings.push("تم تجاهل كود النطاق لأن نطاق الصلاحية \"جميع الجهات\"");
        if (role && scopeType !== defaultScopeType(role)) {
          warnings.push(`نطاق الصلاحية المعتاد لدور ${ROLE_LABELS[role]} هو "${SCOPE_TYPE_LABELS[defaultScopeType(role)]}"`);
        }
      }

      const delegate = normalizeEmail(r.delegate_email);
      if (delegate) {
        if (!isEmail(delegate)) warnings.push(`البريد الإلكتروني للبديل "${text(r.delegate_email)}" بصيغة غير صحيحة`);
        else if (delegate === email) warnings.push("البديل هو المستخدم نفسه");
        else if (!knownDelegates.has(delegate)) warnings.push(`البديل ${delegate} غير موجود في المنظومة ولا في الملف`);
      }

      const label = `${text(r.name) || "—"} · ${email || "—"} · ${role ? ROLE_LABELS[role] : text(r.role)} / ${scopeName}`;
      if (errors.length || !role || !scopeType || !name.value) {
        rows.push({ sheet: SHEET, row: r.__row, status: "error", label, errors, warnings });
        continue;
      }

      const data: ImportUserRow = { email, name: name.value, phone: text(r.phone) || null, role, scopeType, scopeId };
      const key = `${email}#${roleScopeKey(data)}`;
      const prevName = firstName.get(email);
      if (prevName && prevName !== name.value) warnings.push(`البريد الإلكتروني نفسه مسجل باسم آخر في صف سابق (${prevName}) — سيُحفظ بالاسم الوارد في هذا الصف`);
      if (!prevName) firstName.set(email, name.value);

      const userRoles = existingByEmail.get(email);
      if (seen.has(key)) {
        rows.push({ sheet: SHEET, row: r.__row, status: "skip", label, errors, warnings: [...warnings, "صف مكرر في الملف"] });
      } else if (userRoles?.has(roleScopeKey(data))) {
        rows.push({ sheet: SHEET, row: r.__row, status: "skip", label, errors, warnings: [...warnings, "الدور الوظيفي ونطاق الصلاحية مسجلان للمستخدم من قبل"] });
      } else {
        rows.push({ sheet: SHEET, row: r.__row, status: userRoles ? "update" : "create", label, errors, warnings, data });
      }
      seen.add(key);
    }

    const notes: string[] = [];
    if (delegates.length) notes.push("يُستخدم عمود \"البريد الإلكتروني للبديل\" للمراجعة فقط — يتطلب التفويض تحديد فترة (من/إلى)، لذا يُسجَّل من تبويب تفويض الصلاحيات.");
    notes.push("لن تُرسل الدعوات تلقائياً — بعد الحفظ يرجى الضغط على \"إرسال الدعوات للمستخدمين الجدد\".");
    return { templateId: importer.templateId, rows, notes } satisfies ImportPreview<ImportUserRow>;
  },

  async commit(preview, tx) {
    const groups = groupImportRows(preview.rows.flatMap((r) => (r.data ? [r.data] : [])));
    let created = 0;
    let updated = 0;
    let roles = 0;
    for (const g of groups) {
      const res = await upsertImportedUser(tx, g, roleScopeKey);
      if (res.created) created++;
      else updated++;
      roles += res.rolesAdded;
    }
    return {
      message: `تم حفظ ${created} مستخدم جديد وتحديث ${updated} مستخدم (${roles} دور/نطاق). لم تُرسل الدعوات بعد — يرجى الضغط على "إرسال الدعوات للمستخدمين الجدد".`,
      counts: { usersCreated: created, usersUpdated: updated, rolesAdded: roles },
    };
  },
};

registerImporter(importer);
