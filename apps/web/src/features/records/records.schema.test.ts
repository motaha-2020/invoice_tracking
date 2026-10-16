import { describe, expect, it } from "vitest";
import { aoItemSchema, aoSchema, contractItemSchema, toFormValue } from "./records.schema";

const ao = {
  aoNo: " po 25 ", aoDate: "2026-05-19", status: "active", name: "أكتوبر 1", projectId: "", value: "1,250,000.5",
  financialCommitment: "", planningAnnexValue: "", stampsTotal: "", finalGuaranteePct: "5", area: "", centralText: "", outOfScope: "1", duration: "",
};

describe("aoSchema", () => {
  it("بيحوّل النصوص لأنواعها", () => {
    const d = aoSchema.parse(ao);
    expect(d).toMatchObject({ aoNo: "PO25", value: 1250000.5, financialCommitment: null, projectId: null, outOfScope: true, finalGuaranteePct: 5 });
    expect(d.aoDate?.toISOString().slice(0, 10)).toBe("2026-05-19");
  });
  it("بيرفض رقم غير صحيح ونسبة فوق 100", () => {
    expect(aoSchema.safeParse({ ...ao, value: "abc" }).success).toBe(false);
    expect(aoSchema.safeParse({ ...ao, finalGuaranteePct: "120" }).success).toBe(false);
    expect(aoSchema.safeParse({ ...ao, name: " " }).success).toBe(false);
  });
});

describe("contractItemSchema / aoItemSchema", () => {
  it("السعر الفارغ = غير مُسعّر", () => {
    const d = contractItemSchema.parse({ itemNo: "1-1", unit: "م.ط", isGroup: "", description: "حفر", contractQty: "10", unitPrice: "", workType: "" });
    expect(d).toMatchObject({ unitPrice: null, contractQty: 10, isGroup: false, workType: null });
  });
  it("الكمية المخططة إلزامية", () => {
    expect(aoItemSchema.safeParse({ plannedQty: "" }).success).toBe(false);
    expect(aoItemSchema.parse({ plannedQty: "12.5" }).plannedQty).toBe(12.5);
  });
});

describe("toFormValue", () => {
  it("تواريخ وقيم منطقية وفارغ", () => {
    expect(toFormValue(new Date("2026-01-02T00:00:00Z"))).toBe("2026-01-02");
    expect(toFormValue(true)).toBe("1");
    expect(toFormValue(null)).toBe("");
  });
});
