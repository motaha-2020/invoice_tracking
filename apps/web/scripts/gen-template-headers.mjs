// يولّد src/features/imports/template-headers.json من قوالب public/templates:
// لكل قالب وكل شيت جدول: عنوان العمود العربي (صف 1) ← اسمه التقني (صف 2).
// بيستخدمه الـ parser لو المستخدم كتب فوق الصف التقني أو مسحه.
// التشغيل: node apps/web/scripts/gen-template-headers.mjs  (واختبار xlsx-parse بيتأكد إنه متزامن مع القوالب)
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public/templates");
const KEY_RE = /^[a-z][a-z0-9_]*$/;
export const normHeader = (s) => String(s).replace(/\*/g, "").replace(/ـ/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export async function buildHeaders() {
  const out = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".xlsx")).sort()) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(dir, f));
    const id = String(wb.getWorksheet("_meta")?.getRow(1).getCell(2).value ?? f.replace(/\.xlsx$/, ""));
    const sheets = {};
    wb.eachSheet((ws) => {
      if (ws.name === "_meta" || ws.name === "تعليمات") return;
      const map = {};
      ws.getRow(2).eachCell((cell, col) => {
        const key = typeof cell.value === "string" ? cell.value.trim() : "";
        const head = ws.getRow(1).getCell(col).value;
        if (KEY_RE.test(key) && typeof head === "string" && head.trim()) map[normHeader(head)] = key;
      });
      if (Object.keys(map).length) sheets[ws.name] = map;
    });
    out[id] = sheets;
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const json = JSON.stringify(await buildHeaders(), null, 2) + "\n";
  fs.writeFileSync(path.join(root, "src/features/imports/template-headers.json"), json);
  console.log("template-headers.json ✓");
}
