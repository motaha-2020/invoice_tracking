/**
 * تنضيف قيم الخلايا — مشترك بين كل الـ importers عشان القواعد تبقى واحدة.
 * كل دالة بترجع { value } أو { error } (رسالة عربي) — مفيش exceptions.
 */

export type Cell<T> = { value: T; error?: undefined } | { value?: undefined; error: string };

const ARABIC_DIGITS = /[٠-٩]/g;
const toLatinDigits = (s: string) => s.replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660));

/** نص (ممكن يبقى فاضي) */
export function text(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, " ").trim();
}

/** نص إلزامي */
export function required(v: unknown, label: string): Cell<string> {
  const t = text(v);
  return t ? { value: t } : { error: `${label} إلزامي` };
}

/** كود (فريد) — بيتوحّد: مسافات بتتشال، حروف إنجليزي كبيرة */
export function code(v: unknown): string {
  return toLatinDigits(text(v)).replace(/\s+/g, "").toUpperCase();
}

/** رقم البند المتدرج: "1.1.1.2" أو "1-1-1-2" ← "1-1-1-2" */
export function itemNo(v: unknown): Cell<string> {
  const t = toLatinDigits(text(v)).replace(/\s+/g, "").replace(/\./g, "-");
  if (!t) return { error: "رقم البند إلزامي" };
  if (!/^(N-)?\d+(-\d+)*$/i.test(t)) return { error: `رقم البند "${text(v)}" مش بالشكل الصح (زي 1-1-1-2)` };
  return { value: t.toUpperCase() };
}

/** رقم — فاضي = null. بيقبل الفواصل والأرقام العربي */
export function num(v: unknown, label: string, opts: { min?: number; max?: number } = {}): Cell<number | null> {
  if (v == null || v === "") return { value: null };
  const n = typeof v === "number" ? v : Number(toLatinDigits(String(v)).replace(/[,\s٬]/g, ""));
  if (!Number.isFinite(n)) return { error: `${label}: "${text(v)}" مش رقم` };
  if (opts.min != null && n < opts.min) return { error: `${label} لازم ${opts.min} أو أكتر` };
  if (opts.max != null && n > opts.max) return { error: `${label} لازم ${opts.max} أو أقل` };
  return { value: n };
}

/** نسبة مئوية 0..100 */
export const pctCell = (v: unknown, label: string) => num(v, label, { min: 0, max: 100 });

/**
 * تاريخ: Date من Excel، أو "dd/mm/yyyy"، أو "yyyy-mm-dd"، أو "yyyy-mm" (أول الشهر).
 * بيرجع Date بتوقيت UTC منتصف الليل (date-only).
 */
export function date(v: unknown, label: string): Cell<Date | null> {
  if (v == null || v === "") return { value: null };
  if (v instanceof Date) return { value: new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate())) };
  if (typeof v === "number") return { value: new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000) }; // Excel serial
  const t = toLatinDigits(text(v));
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (m) return mk(+m[3]!, +m[2]!, +m[1]!, label, t);
  m = /^(\d{4})[/.-](\d{1,2})(?:[/.-](\d{1,2}))?$/.exec(t);
  if (m) return mk(+m[1]!, +m[2]!, m[3] ? +m[3] : 1, label, t);
  return { error: `${label}: "${t}" مش تاريخ مفهوم (اكتبه يوم/شهر/سنة)` };
}

function mk(y: number, mo: number, d: number, label: string, raw: string): Cell<Date | null> {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || y < 2000 || y > 2100) return { error: `${label}: "${raw}" تاريخ مش صحيح` };
  return { value: dt };
}

/** نعم/لا */
export function yesNo(v: unknown): boolean {
  return ["نعم", "ايوه", "أيوه", "yes", "true", "1", "y"].includes(text(v).toLowerCase());
}

/** صف مثال من القالب (الصفوف الرمادي) — بيتجاهل */
export function isExampleRow(row: Record<string, unknown>): boolean {
  return Object.values(row).some((v) => typeof v === "string" && v.trim().startsWith("مثال"));
}
