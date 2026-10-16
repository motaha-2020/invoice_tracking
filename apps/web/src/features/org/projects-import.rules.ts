/**
 * قواعد قالب 02 (أنواع المشروعات + أنواع الأعمال + المشروعات) — صافية.
 * نوع المشروع: من المنظومة أو من شيت الأنواع في نفس الملف. السنترال: من المنظومة بس (قالب 01).
 * الخلايا الاختيارية الفاضية في صف تحديث = سيب القيمة القديمة زي ما هي.
 */
import { code as normalizeCode, date, text } from "../imports/cells";
import type { RawRow, RowResult } from "../imports/import.types";
import {
  SeenCodes,
  codeCell,
  duplicateError,
  failed,
  exampleWarning,
  optionalText,
  requiredText,
  result,
  rowLabel,
  take,
} from "./import-rules.shared";
import { WORK_TYPES_SHEET, validateWorkType, type ExistingWorkType, type WorkTypeImportRow } from "./work-types-import.rules";

export const TYPES_SHEET = "أنواع المشروعات";
export const PROJECTS_SHEET = "المشروعات";

const TYPE_EXAMPLES = [
  { code: "FIBERIZATION", name: "Fiberization" },
  { code: "ACCESS", name: "إتاحة" },
];
const PROJECT_EXAMPLES = [{ code: "PJ-RABAA", name: "حى الحدق — سنترال رابعة" }];

export type ExistingProject = {
  name: string;
  typeCode: string;
  centralCode: string;
  /** yyyy-mm-dd */
  startDate: string | null;
  notes: string | null;
};

export type ExistingProjectsData = {
  types: ReadonlyMap<string, { name: string }>;
  workTypes: ReadonlyMap<string, ExistingWorkType>;
  centrals: ReadonlyMap<string, { name: string }>;
  projects: ReadonlyMap<string, ExistingProject>;
};

export type ProjectsImportRow =
  | { kind: "type"; code: string; name: string }
  | WorkTypeImportRow
  | {
      kind: "project";
      code: string;
      name: string;
      typeCode: string;
      centralCode: string;
      /** yyyy-mm-dd — بيعدّي على JSON في المعاينة فمش Date. null = فاضي */
      startDate: string | null;
      notes: string | null;
    };

export function validateProjectSheets(
  sheets: Readonly<Record<string, readonly RawRow[] | undefined>>,
  existing: ExistingProjectsData,
): RowResult<ProjectsImportRow>[] {
  const out: RowResult<ProjectsImportRow>[] = [];
  /** الأنواع في الملف: كود ← سليم ولا لأ */
  const fileTypes = new Map<string, boolean>();

  const seenTypes = new SeenCodes();
  for (const row of sheets[TYPES_SHEET] ?? []) {
    const r = validateType(row, existing, seenTypes);
    out.push(r);
    const c = r.data?.code ?? normalizeCode(row.code);
    if (c && !fileTypes.has(c)) fileTypes.set(c, r.data !== undefined);
  }

  const seenWorkTypes = new SeenCodes();
  for (const row of sheets[WORK_TYPES_SHEET] ?? []) out.push(validateWorkType(row, existing.workTypes, seenWorkTypes));

  const seenProjects = new SeenCodes();
  for (const row of sheets[PROJECTS_SHEET] ?? []) out.push(validateProject(row, existing, fileTypes, seenProjects));
  return out;
}

function validateType(row: RawRow, existing: ExistingProjectsData, seen: SeenCodes): RowResult<ProjectsImportRow> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const code = take(codeCell(row.code, "كود النوع"), errors);
  const name = take(requiredText(row.name, "نوع المشروع"), errors);
  const label = rowLabel(code ?? (text(row.code) || undefined), name);
  if (code) {
    const prev = seen.check(code, row.__row);
    if (prev !== null) errors.push(duplicateError(code, prev));
  }
  const ex = exampleWarning(row, TYPE_EXAMPLES);
  if (ex) warnings.push(ex);
  if (errors.length || !code || !name) return failed(TYPES_SHEET, row.__row, label, errors, warnings);

  const data = { kind: "type" as const, code, name };
  const current = existing.types.get(code);
  if (!current) return result(TYPES_SHEET, row.__row, label, errors, warnings, "create", data);
  if (current.name === name) warnings.push("موجود بنفس البيانات — مفيش تغيير");
  return result(TYPES_SHEET, row.__row, label, errors, warnings, current.name === name ? "skip" : "update", data);
}

function validateProject(
  row: RawRow,
  existing: ExistingProjectsData,
  fileTypes: ReadonlyMap<string, boolean>,
  seen: SeenCodes,
): RowResult<ProjectsImportRow> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const code = take(codeCell(row.code, "كود المشروع"), errors);
  const name = take(requiredText(row.name, "اسم المشروع"), errors);
  const label = rowLabel(code ?? (text(row.code) || undefined), name);
  if (code) {
    const prev = seen.check(code, row.__row);
    if (prev !== null) errors.push(duplicateError(code, prev));
  }

  const typeCode = take(codeCell(row.type_code, "كود النوع"), errors);
  if (typeCode) {
    const st = fileTypes.get(typeCode);
    if (st === false && !existing.types.has(typeCode)) errors.push(`نوع المشروع ${typeCode} فيه أخطاء في الملف ومش هيتحفظ — صلّحه الأول`);
    else if (st === undefined && !existing.types.has(typeCode)) errors.push(`مفيش نوع مشروع بالكود ${typeCode} — ضيفه في شيت "${TYPES_SHEET}"`);
  }

  const centralCode = take(codeCell(row.central_code, "كود السنترال"), errors);
  if (centralCode && !existing.centrals.has(centralCode)) {
    errors.push(`مفيش سنترال بالكود ${centralCode} في المنظومة — ارفعه في قالب الهيكل التنظيمي الأول`);
  }

  const start = take(date(row.start_date, "تاريخ البدء"), errors);
  const notes = take(optionalText(row.notes, "الملاحظات", 1000), errors);
  const ex = exampleWarning(row, PROJECT_EXAMPLES);
  if (ex) warnings.push(ex);

  if (errors.length || !code || !name || !typeCode || !centralCode) {
    return failed(PROJECTS_SHEET, row.__row, label, errors, warnings);
  }

  const data: ProjectsImportRow = {
    kind: "project",
    code,
    name,
    typeCode,
    centralCode,
    startDate: start ? start.toISOString().slice(0, 10) : null,
    notes: notes ?? null,
  };
  const current = existing.projects.get(code);
  if (!current) return result(PROJECTS_SHEET, row.__row, label, errors, warnings, "create", data);

  if (current.centralCode !== centralCode) {
    const from = existing.centrals.get(current.centralCode)?.name ?? current.centralCode;
    const to = existing.centrals.get(centralCode)?.name ?? centralCode;
    warnings.push(`المشروع هيتنقل من ${from} لـ ${to} — مستخلصاته هتتبع المكان الجديد`);
  }
  const changed =
    current.name !== name ||
    current.typeCode !== typeCode ||
    current.centralCode !== centralCode ||
    (data.startDate !== null && data.startDate !== current.startDate) ||
    (data.notes !== null && data.notes !== current.notes);
  if (!changed) warnings.push("موجود بنفس البيانات — مفيش تغيير");
  return result(PROJECTS_SHEET, row.__row, label, errors, warnings, changed ? "update" : "skip", data);
}
