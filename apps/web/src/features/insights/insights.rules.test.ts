import { describe, expect, it } from "vitest";
import { pct, stageKey, summarize, type AoFact, type ContractFact, type InvoiceFact } from "./insights.rules";

const bridge = { id: "co1", name: "بريدج" };
const c232 = { id: "c232", contractNo: "232/2025/1/36", company: bridge };
const p1 = { id: "p1", code: "PJ-1", name: "أكتوبر 1" };

const contracts: ContractFact[] = [{ ...c232, title: "Fiberization", contractValue: 1000 }];
const aos: AoFact[] = [
  { id: "a1", value: 600, financialCommitment: 500, contract: c232, project: p1 },
  { id: "a2", value: 300, financialCommitment: null, contract: c232, project: null },
];
const inv = (status: InvoiceFact["status"], gross: number, ao = "a1", step: string | null = null): InvoiceFact => ({
  status,
  currentStep: step,
  heldAt: null,
  gross,
  workType: { name: status === "paid" ? "مدني" : "كهربي" },
  contract: c232,
  ao: { id: ao, aoNo: ao.toUpperCase(), project: ao === "a1" ? p1 : null },
});
const invoices = [inv("paid", 200), inv("active", 100, "a1", "tech"), inv("on_hold", 50, "a2", "sup"), inv("draft", 999), inv("paid", 120, "a2")];

describe("summarize", () => {
  const s = summarize(invoices, aos, contracts, ["sup", "exec", "gm", "tech", "stores", "finance"]);

  it("الإجماليات: المسودة خارج المفوتر، والموقوف ضمن الجاري", () => {
    expect(s.totals).toMatchObject({
      contractValue: 1000, aoValue: 900, commitment: 800, billed: 470, paid: 320, pending: 150, onHold: 50, draft: 999, aoRemaining: 430,
      invoices: 4, paidInvoices: 2, pendingInvoices: 2, aos: 2, contracts: 1,
    });
  });

  it("المراحل بترتيب الرحلة: المقاول ← المسار ← موقوف ← السداد", () => {
    expect(s.byStage.map((x) => x.key)).toEqual(["company", "tech", "hold", "paid"]);
    expect(s.byStage.find((x) => x.key === "paid")).toEqual({ key: "paid", count: 2, amount: 320 });
  });

  it("التجميع حسب الشركة والمشروع وأمر التكليف", () => {
    expect(s.byCompany).toEqual([expect.objectContaining({ id: "co1", aoValue: 900, billed: 470, paid: 320, pending: 150, invoices: 4, aos: 2 })]);
    expect(s.byProject).toEqual([expect.objectContaining({ id: "p1", aoValue: 600, billed: 300, invoices: 2 })]);
    expect(s.byAo.get("a2")).toMatchObject({ aoValue: 300, billed: 170, paid: 120, pending: 50 });
  });

  it("نوع الأعمال بالأعلى مفوتراً", () => {
    expect(s.byWorkType[0]).toEqual({ label: "مدني", billed: 320, count: 2 });
  });
});

describe("helpers", () => {
  it("stageKey", () => {
    expect(stageKey({ status: "returned", currentStep: "gm" })).toBe("returned");
    expect(stageKey({ status: "active", currentStep: "gm" })).toBe("gm");
  });
  it("pct بالمقام صفر", () => {
    expect(pct(5, 0)).toBe(0);
    expect(pct(50, 200)).toBe(25);
  });
});
