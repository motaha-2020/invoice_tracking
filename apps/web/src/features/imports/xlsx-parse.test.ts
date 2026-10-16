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

  it("يتعرف على الأعمدة من العناوين لو المستخدم كتب فوق الصف التقني (صف 2)", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("رئاسات القطاعات");
    ws.addRow(["كود الرئاسة *", "اسم رئاسة القطاعات *"]);
    ws.addRow(["C&S", "رئاسة قطاعات القاهرة والجنوبية"]);
    ws.addRow(["E&W", "رئاسة قطاعات الشرقية والغربية"]);
    const ws2 = wb.addWorksheet("القطاعات");
    ws2.addRow(["كود القطاع *", "كود الرئاسة *", "اسم القطاع *"]); // الصف التقني اتمسح خالص
    ws2.addRow(["S1", "C&S", "قطاع القاهرة"]);
    const meta = wb.addWorksheet("_meta");
    meta.addRow(["template_id", "01_الهيكل_التنظيمي"]);
    const parsed = await parseWorkbook((await wb.xlsx.writeBuffer()) as ArrayBuffer, []);
    const a = parsed.sheets["رئاسات القطاعات"];
    expect(a?.kind === "table" && a.rows).toEqual([
      { __row: 2, code: "C&S", name: "رئاسة قطاعات القاهرة والجنوبية" },
      { __row: 3, code: "E&W", name: "رئاسة قطاعات الشرقية والغربية" },
    ]);
    const b = parsed.sheets["القطاعات"];
    expect(b?.kind === "table" && b.rows).toEqual([{ __row: 2, code: "S1", presidency_code: "C&S", name: "قطاع القاهرة" }]);
  });
});

describe("template-headers.json", () => {
  it("متزامن مع القوالب في public/templates (لو فشل: node apps/web/scripts/gen-template-headers.mjs)", async () => {
    const { buildHeaders } = await import("../../../scripts/gen-template-headers.mjs");
    const json = (await import("./template-headers.json")).default;
    expect(await buildHeaders()).toEqual(json);
  });
});
