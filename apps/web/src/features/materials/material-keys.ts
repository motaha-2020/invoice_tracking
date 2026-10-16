/**
 * توحيد المفاتيح اللي بتيجي من ملفات Excel (رقم العقد / أمر التكليف / رقم الشطب) — دوال صافية.
 * بنقارن بالشكل الموحّد على الناحيتين، فمش مهم الـ importer التاني خزّن الرقم إزاي.
 */
import { code, text } from "../imports/cells";

/**
 * رقم أمر التكليف: "25" / "PO 25" / "po-25" / "PO025" ← "PO25"، و"1" ← "PO01"
 * (الترقيم في ملفات الموقف PO01..PO32). أي شكل تاني (زي "WO-0012") بيرجع موحّد بس من غير تغيير.
 */
export function normalizeAoNo(v: unknown): string {
  const t = code(v);
  const m = /^(?:PO)?[-_./]?0*(\d+)$/.exec(t);
  if (!m) return t;
  return `PO${m[1]!.padStart(2, "0")}`;
}

/** رقم العقد: أرقام لاتيني ومن غير مسافات ("232 / 2025 / 1 / 36" ← "232/2025/1/36") */
export function normalizeContractNo(v: unknown): string {
  return code(v).replace(/\\/g, "/");
}

/** رقم الشطب: زي ما هو مكتوب (بالنقط) — بس من غير مسافات زيادة */
export function materialCode(v: unknown): string {
  return text(v);
}
