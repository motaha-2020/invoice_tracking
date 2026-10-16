import "server-only";
import ExcelJS from "exceljs";
import type { ParsedSheet, ParsedWorkbook, RawRow } from "./import.types";
import TEMPLATE_HEADERS from "./template-headers.json";

/** أقصى حجم لملف الاستيراد — المقايسة الكبيرة ~50KB، فده كافي جداً */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/** قيمة الخلية كـ قيمة بسيطة (نص / رقم / تاريخ) — exceljs بيرجع objects للمعادلات والنصوص المنسقة */
function cellValue(v: ExcelJS.CellValue): unknown {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return cellValue(v.result as ExcelJS.CellValue); // معادلة
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return (v as { text: string }).text; // hyperlink
    if ("error" in v) return null;
  }
  return v;
}

/** نص الخلية زي ما build_templates.py بيكتب صفوف المثال في _meta (str في بايثون) */
function exampleText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/**
 * examples = صفوف المثال الرمادي من _meta. أي صف مطابق لواحد منها بالظبط بيتجاهل
 * (المستخدم نسي يمسحها) — أما لو كتب فوقها بياناته، الصف مش هيطابق ومش هيتجاهل.
 */
/** فاصل بين خلايا الصف عند مقارنته بصفوف المثال (مستحيل يظهر في بيانات حقيقية) */
const SEP = "\u0001";

const KEY_RE = /^[a-z][a-z0-9_]*$/;

/** عنوان العمود العربي بشكل موحّد (من غير * ولا مسافات زيادة) — نفس normHeader في scripts/gen-template-headers.mjs */
export const normHeader = (s: string) => s.replace(/\*/g, "").replace(/\u0640/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * أسماء الأعمدة التقنية: من صف 2 في القالب. لو المستخدم كتب بياناته فوق الصف ده أو مسحه
 * (أشهر غلطة — بيبدأ يكتب تحت العناوين على طول)، بنعرف الأعمدة من العناوين العربي في صف 1
 * (template-headers.json) والبيانات بتبدأ من صف 2.
 */
function columnKeys(ws: ExcelJS.Worksheet, headers?: Record<string, string>): { keys: (string | null)[]; start: number } {
  const row2: (string | null)[] = [];
  ws.getRow(2).eachCell({ includeEmpty: true }, (cell, col) => {
    const k = cellValue(cell.value);
    row2[col] = typeof k === "string" && k.trim() ? k.trim() : null;
  });
  const filled = row2.filter((k): k is string => !!k);
  if (!headers || (filled.length > 0 && filled.every((k) => KEY_RE.test(k)))) return { keys: row2, start: 3 };
  const keys: (string | null)[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    const h = cellValue(cell.value);
    keys[col] = typeof h === "string" ? (headers[normHeader(h)] ?? null) : null;
  });
  return keys.some(Boolean) ? { keys, start: 2 } : { keys: row2, start: 3 };
}

function parseTable(ws: ExcelJS.Worksheet, examples: string[][] = [], skipped: number[] = [], headers?: Record<string, string>): ParsedSheet {
  const exampleKeys = new Set(examples.map((e) => e.join(SEP)));
  const { keys, start } = columnKeys(ws, headers);
  const rows: RawRow[] = [];
  for (let r = start; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const out: RawRow = { __row: r };
    let any = false;
    const texts: string[] = [];
    keys.forEach((k, col) => {
      if (!k) return;
      const v = cellValue(row.getCell(col).value);
      texts[col - 1] = exampleText(v);
      if (v !== null && v !== "") any = true;
      out[k] = typeof v === "string" ? v.trim() : v;
    });
    const width = examples[0]?.length ?? 0;
    const isExample = width > 0 && exampleKeys.has(Array.from({ length: width }, (_, i) => texts[i] ?? "").join(SEP));
    if (any && isExample) skipped.push(r);
    else if (any) rows.push(out);
  }
  return { name: ws.name, kind: "table", rows };
}

function parseKv(ws: ExcelJS.Worksheet): ParsedSheet {
  const values: Record<string, unknown> = {};
  for (let r = 2; r <= ws.rowCount; r++) {
    const key = cellValue(ws.getRow(r).getCell(3).value);
    if (typeof key !== "string" || !key.trim()) continue;
    const v = cellValue(ws.getRow(r).getCell(2).value);
    values[key.trim()] = typeof v === "string" ? v.trim() : v;
  }
  return { name: ws.name, kind: "kv", values };
}

/**
 * يقرا ملف القالب. kvSheets = أسماء الشيتات اللي شكلها مفتاح/قيمة.
 * الشيتات اللي مش مطلوبة (تعليمات، _meta) بتتجاهل.
 */
export async function parseWorkbook(buffer: ArrayBuffer, kvSheets: string[]): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const meta = wb.getWorksheet("_meta");
  const metaVal = (r: number) => {
    const v = meta ? cellValue(meta.getRow(r).getCell(2).value) : null;
    return v == null ? null : String(v);
  };
  let examples: Record<string, string[][]> = {};
  try {
    examples = JSON.parse(metaVal(3) ?? "{}") as Record<string, string[][]>;
  } catch {
    examples = {};
  }
  const templateId = metaVal(1);
  const headers = (templateId ? (TEMPLATE_HEADERS as Record<string, Record<string, Record<string, string>>>)[templateId] : undefined) ?? {};
  const sheets: Record<string, ParsedSheet> = {};
  const skippedExamples: Record<string, number[]> = {};
  wb.eachSheet((ws) => {
    if (ws.name === "_meta" || ws.name === "تعليمات") return;
    const skipped: number[] = [];
    sheets[ws.name] = kvSheets.includes(ws.name) ? parseKv(ws) : parseTable(ws, examples[ws.name], skipped, headers[ws.name]);
    if (skipped.length) skippedExamples[ws.name] = skipped;
  });
  return { templateId, templateVersion: metaVal(2), sheets, skippedExamples };
}
