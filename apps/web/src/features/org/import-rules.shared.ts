/**
 * أدوات مشتركة لقواعد استيراد قوالب 01/02/03 — دوال صافية (من غير DB) عشان تتختبر.
 */
import { code as normalizeCode, text, type Cell } from "../imports/cells";
import type { RawRow, RowResult, RowStatus } from "../imports/import.types";

export const CODE_MAX = 40;
export const NAME_MAX = 200;

/** حروف (عربي أو إنجليزي) وأرقام و - _ . / & بس، ويبدأ بحرف أو رقم (مثال: C&S) */
export const CODE_RE = /^[\p{L}\p{N}][\p{L}\p{N}._\-/&]*$/u;

/** كود فريد: بيتوحّد (من غير مسافات، حروف كبيرة) ويتأكد من الشكل والطول */
export function codeCell(v: unknown, label = "الكود"): Cell<string> {
  const c = normalizeCode(v);
  if (!c) return { error: `${label} إلزامي` };
  if (c.length > CODE_MAX) return { error: `${label} "${c}" يتجاوز ${CODE_MAX} حرفاً` };
  if (!CODE_RE.test(c)) return { error: `${label} "${c}" يتضمن رموزاً غير مسموحة (المسموح: الحروف والأرقام و - _ . / & فقط)` };
  return { value: c };
}

/** نص إلزامي بحد أقصى للطول */
export function requiredText(v: unknown, label: string, max = NAME_MAX): Cell<string> {
  const t = text(v);
  if (!t) return { error: `${label} إلزامي` };
  if (t.length > max) return { error: `${label} يتجاوز ${max} حرفاً` };
  return { value: t };
}

/** نص اختياري — فاضي = null */
export function optionalText(v: unknown, label: string, max = NAME_MAX): Cell<string | null> {
  const t = text(v);
  if (!t) return { value: null };
  if (t.length > max) return { error: `${label} يتجاوز ${max} حرفاً` };
  return { value: t };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** إيميل اختياري (lowercase) — فاضي = null */
export function optionalEmail(v: unknown, label: string): Cell<string | null> {
  const t = text(v).toLowerCase();
  if (!t) return { value: null };
  if (t.length > 200 || !EMAIL_RE.test(t)) return { error: `${label} "${t}" بصيغة غير صحيحة` };
  return { value: t };
}

/** بيجمع أخطاء الخلايا في مصفوفة ويرجع القيمة (أو undefined لو فيها خطأ) */
export function take<T>(cell: Cell<T>, errors: string[]): T | undefined {
  if (cell.error !== undefined) {
    errors.push(cell.error);
    return undefined;
  }
  return cell.value;
}

/**
 * متابعة التكرار جوه الشيت: أول ظهور للكود بيتسجل، والتاني بياخد خطأ.
 * بترجع رقم الصف اللي ظهر فيه الكود قبل كده (أو null).
 */
export class SeenCodes {
  private readonly rows = new Map<string, number>();
  check(code: string, row: number): number | null {
    const prev = this.rows.get(code);
    if (prev !== undefined) return prev;
    this.rows.set(code, row);
    return null;
  }
}

export const duplicateError = (code: string, prevRow: number) => `الكود ${code} مكرر في ورقة العمل (ورد أول مرة في الصف ${prevRow})`;

/** صفوف المثال من القالب: لو الصف مطابق للمثال (كود + اسم) بنحذّر — المفروض يتمسح قبل الرفع */
export function exampleWarning(row: RawRow, examples: readonly { code: string; name: string }[]): string | null {
  const c = normalizeCode(row.code);
  const n = text(row.name);
  return examples.some((e) => e.code === c && e.name === n) ? "يبدو أن هذا الصف هو صف المثال الوارد في النموذج — يرجى حذفه إن لم يكن بيانات فعلية" : null;
}

/** بناء نتيجة الصف: أي خطأ = status error ومن غير data */
export function result<T>(
  sheet: string,
  row: number,
  label: string,
  errors: string[],
  warnings: string[],
  status: Exclude<RowStatus, "error">,
  data: T | undefined,
): RowResult<T> {
  if (errors.length || data === undefined) {
    return { sheet, row, label, status: "error", errors: errors.length ? errors : ["بيانات الصف غير مكتملة"], warnings };
  }
  return { sheet, row, label, status, errors, warnings, data };
}

/** صف مرفوض (فيه أخطاء) */
export function failed(sheet: string, row: number, label: string, errors: string[], warnings: string[]): RowResult<never> {
  return result<never>(sheet, row, label, errors, warnings, "create", undefined);
}

export const rowLabel = (code: string | undefined, name: string | undefined) =>
  [code, name].filter(Boolean).join(" — ") || "صف بدون كود";
