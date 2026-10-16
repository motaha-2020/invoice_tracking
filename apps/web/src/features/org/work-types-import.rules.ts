/**
 * شيت "أنواع الأعمال" في قالب 02 (اختياري) — صافي.
 * is_planning فاضي في صف تحديث = سيب القيمة القديمة، وفي صف جديد = لأ.
 */
import { text, yesNo } from "../imports/cells";
import type { RawRow, RowResult } from "../imports/import.types";
import { SeenCodes, codeCell, duplicateError, exampleWarning, failed, requiredText, result, rowLabel, take } from "./import-rules.shared";

export const WORK_TYPES_SHEET = "أنواع الأعمال";

const WORK_TYPE_EXAMPLES = [{ code: "CIVIL_MAINT", name: "صيانة مدني" }];

export type ExistingWorkType = { name: string; isPlanning: boolean };

/** isPlanning null = الخلية فاضية */
export type WorkTypeImportRow = { kind: "workType"; code: string; name: string; isPlanning: boolean | null };

export function validateWorkType(
  row: RawRow,
  existing: ReadonlyMap<string, ExistingWorkType>,
  seen: SeenCodes,
): RowResult<WorkTypeImportRow> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const code = take(codeCell(row.code, "كود نوع الأعمال"), errors);
  const name = take(requiredText(row.name, "نوع الأعمال"), errors);
  const label = rowLabel(code ?? (text(row.code) || undefined), name);
  if (code) {
    const prev = seen.check(code, row.__row);
    if (prev !== null) errors.push(duplicateError(code, prev));
  }
  const ex = exampleWarning(row, WORK_TYPE_EXAMPLES);
  if (ex) warnings.push(ex);
  if (errors.length || !code || !name) return failed(WORK_TYPES_SHEET, row.__row, label, errors, warnings);

  const isPlanning = text(row.is_planning) ? yesNo(row.is_planning) : null;
  const data: WorkTypeImportRow = { kind: "workType", code, name, isPlanning };
  const current = existing.get(code);
  if (!current) return result(WORK_TYPES_SHEET, row.__row, label, errors, warnings, "create", data);
  const changed = current.name !== name || (isPlanning !== null && isPlanning !== current.isPlanning);
  if (!changed) warnings.push("موجود بنفس البيانات — مفيش تغيير");
  return result(WORK_TYPES_SHEET, row.__row, label, errors, warnings, changed ? "update" : "skip", data);
}
