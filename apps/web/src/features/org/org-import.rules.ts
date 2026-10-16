/**
 * قواعد قالب 01 (الهيكل التنظيمي) — صافية. الشيتات بتتفحص بالترتيب من فوق لتحت،
 * وكود الأب لازم يبقى موجود في المنظومة أو في صف سليم في نفس الملف قبله.
 */
import { code as normalizeCode, text } from "../imports/cells";
import type { RawRow, RowResult } from "../imports/import.types";
import {
  SeenCodes,
  codeCell,
  duplicateError,
  failed,
  exampleWarning,
  optionalEmail,
  requiredText,
  result,
  rowLabel,
  take,
} from "./import-rules.shared";
import { KIND_LABELS, ORG_LEVELS, PARENT_LEVEL, type OrgLevel } from "./org.kinds";

type SheetDef = {
  level: OrgLevel;
  sheet: string;
  /** اسم عمود كود الأب (صف 2 في القالب) */
  parentKey: string | null;
  example: { code: string; name: string };
};

/** نفس ترتيب الشيتات في القالب (scripts/build_templates.py) — الأب دايماً قبل الابن */
export const ORG_SHEETS: readonly SheetDef[] = [
  { level: "presidency", sheet: "رئاسات القطاعات", parentKey: null, example: { code: "PR-DELTA", name: "رئاسة قطاعات الدلتا والقناة" } },
  { level: "sector", sheet: "القطاعات", parentKey: "presidency_code", example: { code: "S-EAST", name: "المنطقة الشرقية" } },
  { level: "generalDept", sheet: "الإدارات العامة", parentKey: "sector_code", example: { code: "G-SINAI", name: "الإدارة العامة لمناطق شمال سيناء" } },
  { level: "techUnit", sheet: "الشئون الفنية", parentKey: "sector_code", example: { code: "TA-EAST", name: "الشئون الفنية — المنطقة الشرقية" } },
  { level: "dept", sheet: "الإدارات المختصة", parentKey: "gdept_code", example: { code: "D-ARISH", name: "إدارة تنفيذ العريش" } },
  { level: "central", sheet: "السنترالات", parentKey: "dept_code", example: { code: "C-RABAA", name: "سنترال رابعة" } },
];

export type ExistingNode = { name: string; parentCode: string | null };
export type ExistingOrg = Record<OrgLevel, ReadonlyMap<string, ExistingNode>>;
export type UserLookup = ReadonlyMap<string, { id: string; name: string }>;

export type OrgImportRow = {
  level: OrgLevel;
  code: string;
  name: string;
  parentCode: string | null;
  /** للإدارة العامة بس: المستخدم اللي هيتربط كمدير عام */
  gmUserId: string | null;
};

export function emptyExistingOrg(): ExistingOrg {
  return Object.fromEntries(ORG_LEVELS.map((l) => [l, new Map()])) as unknown as ExistingOrg;
}

/** حالة كود في الملف: سليم (هيتحفظ) أو فيه أخطاء */
type InFile = Record<OrgLevel, Map<string, boolean>>;

/**
 * يفحص كل شيتات القالب. sheets = صفوف كل شيت بالاسم.
 * existing = الموجود في DB لكل مستوى (كود ← الاسم وكود الأب)، users = إيميل ← مستخدم (لربط المدير العام).
 */
export function validateOrgSheets(
  sheets: Readonly<Record<string, readonly RawRow[] | undefined>>,
  existing: ExistingOrg,
  users: UserLookup = new Map(),
): RowResult<OrgImportRow>[] {
  const inFile = Object.fromEntries(ORG_LEVELS.map((l) => [l, new Map<string, boolean>()])) as unknown as InFile;
  const out: RowResult<OrgImportRow>[] = [];
  for (const def of ORG_SHEETS) {
    const seen = new SeenCodes();
    for (const row of sheets[def.sheet] ?? []) {
      const r = validateRow(def, row, existing, inFile, seen, users);
      out.push(r);
      // أول ظهور للكود بس هو اللي بيحدد هل الأبناء يقدروا يعتمدوا عليه
      const c = r.data?.code ?? normalizeCode(row.code);
      if (c && !inFile[def.level].has(c)) inFile[def.level].set(c, r.data !== undefined);
    }
  }
  return out;
}

function validateRow(
  def: SheetDef,
  row: RawRow,
  existing: ExistingOrg,
  inFile: InFile,
  seen: SeenCodes,
  users: UserLookup,
): RowResult<OrgImportRow> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const code = take(codeCell(row.code), errors);
  const name = take(requiredText(row.name, "الاسم"), errors);
  const label = rowLabel(code ?? (text(row.code) || undefined), name);

  if (code) {
    const prev = seen.check(code, row.__row);
    if (prev !== null) errors.push(duplicateError(code, prev));
  }

  const parentCode = def.parentKey ? resolveParent(def, row[def.parentKey], existing, inFile, errors) : null;

  let gmUserId: string | null = null;
  if (def.level === "generalDept") {
    const email = take(optionalEmail(row.gm_email, "إيميل المدير العام"), errors);
    if (email) {
      const u = users.get(email);
      if (u) gmUserId = u.id;
      else warnings.push(`مفيش مستخدم بالإيميل ${email} لسه — مش هيتربط كمدير عام (ارفع قالب المستخدمين الأول)`);
    }
  }

  const ex = exampleWarning(row, [def.example]);
  if (ex) warnings.push(ex);

  if (errors.length || !code || !name) return failed(def.sheet, row.__row, label, errors, warnings);

  const data: OrgImportRow = { level: def.level, code, name, parentCode, gmUserId };
  const current = existing[def.level].get(code);
  if (!current) return result(def.sheet, row.__row, label, errors, warnings, "create", data);

  if (parentCode && current.parentCode && current.parentCode !== parentCode) {
    warnings.push(`الكود ده موجود تحت ${current.parentCode} في المنظومة — الرفع بيحدّث الاسم بس ومش بينقله (النقل من شاشة الهيكل)`);
  }
  const changed = current.name !== name || gmUserId !== null;
  if (!changed) warnings.push("موجود بنفس البيانات — مفيش تغيير");
  return result(def.sheet, row.__row, label, errors, warnings, changed ? "update" : "skip", data);
}

function resolveParent(def: SheetDef, raw: unknown, existing: ExistingOrg, inFile: InFile, errors: string[]): string | null {
  const level = PARENT_LEVEL[def.level]!;
  const { one, fem } = KIND_LABELS[level];
  const p = normalizeCode(raw);
  if (!p) {
    errors.push(`كود ${one} إلزامي`);
    return null;
  }
  const fileState = inFile[level].get(p);
  if (fileState === true || existing[level].has(p)) return p;
  if (fileState === false) errors.push(`${one} ${p} ${fem ? "فيها أخطاء في الملف ومش هتتحفظ — صلّحها" : "فيه أخطاء في الملف ومش هيتحفظ — صلّحه"} الأول`);
  else errors.push(`مفيش ${one} بالكود ${p} — لا في المنظومة ولا في الملف`);
  return null;
}
