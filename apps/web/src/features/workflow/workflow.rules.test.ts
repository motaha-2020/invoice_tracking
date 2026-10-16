import { describe, expect, it } from "vitest";
import {
  cellsFromRows,
  matrixToCategorySteps,
  orderedPath,
  parseSla,
  pathSteps,
  readSettings,
  removedSteps,
  sameCells,
  toggleCell,
  totalSla,
  validateCells,
  type StepMeta,
} from "./workflow.rules";

const keys = ["company", "sup", "exec", "gm", "tech", "plan", "pres", "committee", "pricing", "sector", "stores", "finance"];
const steps: StepMeta[] = keys.map((key, sort) => ({ key, name: key, short: key, role: "pmo", sort }));

describe("pathSteps", () => {
  it("محطة الشركة مش في المصفوفة، والترتيب بـ sort", () => {
    const shuffled = [...steps].reverse();
    expect(pathSteps(shuffled).map((s) => s.key)).toEqual(keys.slice(1));
  });
});

describe("المصفوفة ← category_steps", () => {
  it("الترتيب من WorkflowStep.sort مش من ترتيب الإدخال، و seq من 1", () => {
    const cells = { finance: 3, exec: 2, sup: null, stores: 2 };
    expect(matrixToCategorySteps("C1", cells, steps)).toEqual([
      { categoryCode: "C1", stepKey: "sup", seq: 1, slaDays: null },
      { categoryCode: "C1", stepKey: "exec", seq: 2, slaDays: 2 },
      { categoryCode: "C1", stepKey: "stores", seq: 3, slaDays: 2 },
      { categoryCode: "C1", stepKey: "finance", seq: 4, slaDays: 3 },
    ]);
  });

  it("تشغيل محطة بيدخلها في مكانها (gm بين exec و stores)", () => {
    const cells = toggleCell({ sup: null, exec: 2, stores: 2, finance: 3 }, "gm", true);
    expect(orderedPath(cells, steps).map((p) => p.stepKey)).toEqual(["sup", "exec", "gm", "stores", "finance"]);
    expect(cells.gm).toBe(2);
  });

  it("إيقاف محطة بيشيلها، والتشغيل لموجودة ما يغيّرش الـ SLA", () => {
    const c = { exec: 5, finance: 3 };
    expect(toggleCell(c, "exec", false)).toEqual({ finance: 3 });
    expect(toggleCell(c, "exec", true)).toBe(c);
  });

  it("round-trip: صفوف ← خانات ← صفوف", () => {
    const rows = [
      { stepKey: "sup", slaDays: null },
      { stepKey: "exec", slaDays: 1 },
      { stepKey: "finance", slaDays: 3 },
    ];
    const cells = cellsFromRows(rows);
    expect(matrixToCategorySteps("C2", cells, steps).map(({ stepKey, slaDays }) => ({ stepKey, slaDays }))).toEqual(rows);
    expect(totalSla(cells)).toBe(4);
  });
});

describe("validateCells", () => {
  it("مسار سليم", () => {
    expect(validateCells("C1", { sup: null, exec: 2, finance: 3 }, steps)).toBeNull();
  });
  it("فاضي / من غير exec / مش بيخلص بالمالية / محطة غلط", () => {
    expect(validateCells("C1", {}, steps)).toMatch(/فارغ/);
    expect(validateCells("C1", { sup: 1, finance: 3 }, steps)).toMatch(/exec/);
    expect(validateCells("C1", { exec: 1, stores: 2 }, steps)).toMatch(/المالية/);
    expect(validateCells("C1", { exec: 1, company: 1, finance: 1 }, steps)).toMatch(/company/);
    expect(validateCells("C1", { exec: 1.5, finance: 1 }, steps)).toMatch(/SLA/);
  });
});

describe("أدوات مساعدة", () => {
  it("parseSla", () => {
    expect(parseSla("")).toEqual({ value: null });
    expect(parseSla(" 7 ")).toEqual({ value: 7 });
    expect(parseSla("٣")).toEqual({ value: 3 });
    expect(parseSla("61").error).toBeTruthy();
    expect(parseSla("-1").error).toBeTruthy();
    expect(parseSla("2.5").error).toBeTruthy();
  });

  it("removedSteps و sameCells", () => {
    expect(removedSteps({ a: 1, b: 2 }, { b: 2, c: 1 })).toEqual(["a"]);
    expect(sameCells({ a: 1, b: null }, { b: null, a: 1 })).toBe(true);
    expect(sameCells({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameCells({ a: null }, {})).toBe(false);
  });

  it("readSettings: القيم الغلط بترجع للافتراضي", () => {
    expect(readSettings({ slaWarnAt: 2, dailyDigestAt: "07:30", weeklyReportDay: "thu" })).toEqual({ slaWarnAt: 2, dailyDigestAt: "07:30", weeklyReportDay: "thu" });
    expect(readSettings({ slaWarnAt: "x", dailyDigestAt: "25:00", weeklyReportDay: "xyz" })).toEqual({ slaWarnAt: 1, dailyDigestAt: "08:00", weeklyReportDay: "sun" });
  });
});
