import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { parseWorkbook } = await import("./xlsx-parse");

/** قالب صغير بنفس شكل build_templates.py: صف عناوين، صف مفاتيح، أمثلة، و _meta */
async function makeWorkbook(rows: unknown[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("المستخدمين");
  ws.addRow(["الاسم *", "الإيميل *"]);
  ws.addRow(["name", "email"]);
  rows.forEach((r) => ws.addRow(r));
  const meta = wb.addWorksheet("_meta");
  meta.addRow(["template_id", "04_المستخدمين"]);
  meta.addRow(["version", "1.0"]);
  meta.addRow(["examples", JSON.stringify({ "المستخدمين": [["م. محمد عليوة", "exec.arish@te.eg"]] })]);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

describe("parseWorkbook", () => {
  it("بيقرا المفاتيح من الصف التاني والـ meta", async () => {
    const wb = await parseWorkbook(await makeWorkbook([["أحمد", "a@x.eg"]]), []);
    expect(wb.templateId).toBe("04_المستخدمين");
    const s = wb.sheets["المستخدمين"];
    expect(s?.kind === "table" && s.rows).toEqual([{ __row: 3, name: "أحمد", email: "a@x.eg" }]);
  });

  it("بيتجاهل صف المثال لو المستخدم نسي يمسحه", async () => {
    const wb = await parseWorkbook(await makeWorkbook([["م. محمد عليوة", "exec.arish@te.eg"], ["أحمد", "a@x.eg"]]), []);
    const s = wb.sheets["المستخدمين"];
    expect(s?.kind === "table" && s.rows.map((r) => r.name)).toEqual(["أحمد"]);
  });

  it("ما بيتجاهلش صف المثال لو المستخدم عدّل فيه", async () => {
    const wb = await parseWorkbook(await makeWorkbook([["م. محمد عليوة", "real@te.eg"]]), []);
    const s = wb.sheets["المستخدمين"];
    expect(s?.kind === "table" && s.rows.length).toBe(1);
  });
});
