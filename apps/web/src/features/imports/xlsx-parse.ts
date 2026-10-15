import "server-only";
import ExcelJS from "exceljs";
import type { ParsedSheet, ParsedWorkbook, RawRow } from "./import.types";

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

function parseTable(ws: ExcelJS.Worksheet): ParsedSheet {
  const keys: (string | null)[] = [];
  ws.getRow(2).eachCell({ includeEmpty: true }, (cell, col) => {
    const k = cellValue(cell.value);
    keys[col] = typeof k === "string" && k.trim() ? k.trim() : null;
  });
  const rows: RawRow[] = [];
  for (let r = 3; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const out: RawRow = { __row: r };
    let any = false;
    keys.forEach((k, col) => {
      if (!k) return;
      const v = cellValue(row.getCell(col).value);
      if (v !== null && v !== "") any = true;
      out[k] = typeof v === "string" ? v.trim() : v;
    });
    if (any) rows.push(out);
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
  const sheets: Record<string, ParsedSheet> = {};
  wb.eachSheet((ws) => {
    if (ws.name === "_meta" || ws.name === "تعليمات") return;
    sheets[ws.name] = kvSheets.includes(ws.name) ? parseKv(ws) : parseTable(ws);
  });
  return { templateId: metaVal(1), templateVersion: metaVal(2), sheets };
}
