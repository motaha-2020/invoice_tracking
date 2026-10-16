import { describe, expect, it } from "vitest";
import { contractEditSchema } from "./contract-edit.schema";

const base = {
  title: "عقد", contractValue: "359,533,200", currency: "egp", awardDate: "2026-03-31", startDate: "", endDate: "",
  payMonthlyPct: "70", payAsbuiltPct: "20", payHandoverPct: "10", planningPayPct: "100", vatPct: "14", taxPct: "",
  finalGuaranteePct: "5", delayFinePctWeek: "2", delayFineCapPct: "10", warrantyMonths: "12",
  stampEngineeringPct: "0.3", stampAppliedArtsPct: "0.3", stampConstructionPct: "0.05", retentionPct: "0", advancePct: "0", outOfScopeUplift: " ",
};

describe("contractEditSchema", () => {
  it("parses form strings: commas, empty optionals → null, currency upper-cased", () => {
    const v = contractEditSchema.parse(base);
    expect(v).toMatchObject({ contractValue: 359533200, currency: "EGP", startDate: null, taxPct: null, warrantyMonths: 12, stampConstructionPct: 0.05, outOfScopeUplift: null });
  });
  it("rejects bad values with Arabic messages", () => {
    const err = (patch: object) => contractEditSchema.safeParse({ ...base, ...patch }).error?.issues[0]?.message;
    expect(err({ vatPct: "abc" })).toContain("ضريبة القيمة المضافة");
    expect(err({ payMonthlyPct: "120" })).toContain("لا يزيد عن 100");
    expect(err({ warrantyMonths: "1.5" })).toContain("الضمان الفني");
    expect(err({ title: " " })).toContain("موضوع العقد");
    expect(err({ startDate: "2026-05-01", endDate: "2026-04-01" })).toContain("بعد تاريخ البدء");
    expect(err({ stampEngineeringPct: "11" })).toContain("لا يزيد عن 10");
  });
});
