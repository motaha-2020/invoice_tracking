import { describe, expect, it } from "vitest";
import { UNLINKED, gaugePct, levelOf, orgTiles, stageProgress, type DashAo, type DashInvoice } from "./dashboard.rules";

const gdA = { id: "gA", name: "شرق الدلتا 2" };
const proj = (central: string) => ({ central: { id: central, name: `سنترال ${central}`, dept: { generalDept: gdA } } });

const aos: DashAo[] = [
  { id: "a1", value: 1000, project: proj("c1") },
  { id: "a2", value: 500, project: proj("c2") },
  { id: "a3", value: 400, project: null },
];
const inv = (p: Partial<DashInvoice> & Pick<DashInvoice, "status">): DashInvoice => ({
  currentStep: null, heldAt: null, category: null, suggestedCategory: null, gross: 100, ao: { id: "a1", project: proj("c1") }, ...p,
});

describe("orgTiles", () => {
  const invoices = [
    inv({ status: "paid", gross: 600 }),
    inv({ status: "active", currentStep: "gm", gross: 150, ao: { id: "a2", project: proj("c2") } }),
    inv({ status: "active", currentStep: "sup", gross: 100, ao: { id: "a3", project: null } }),
    inv({ status: "draft", gross: 999 }),
  ];
  it("حسب الإدارة العامة — وغير المرتبط في الآخر", () => {
    const t = orgTiles(invoices, aos, "generalDept");
    expect(t.map((x) => x.id)).toEqual(["gA", UNLINKED]);
    expect(t[0]).toMatchObject({ aoValue: 1500, billed: 750, pct: 50, invoices: 2 });
    expect(t[1]).toMatchObject({ aoValue: 400, billed: 100, pct: 25 });
  });
  it("حسب السنترال", () => {
    const t = orgTiles(invoices, aos, "central");
    expect(t.find((x) => x.id === "c2")).toMatchObject({ aoValue: 500, billed: 150, pct: 30 });
  });
});

describe("stageProgress", () => {
  const paths = { C1: ["sup", "exec", "gm", "tech", "stores", "finance"], C2: ["sup", "exec", "gm", "tech", "plan", "stores", "finance"] };
  const order = ["sup", "exec", "gm", "tech", "plan", "stores", "finance"];
  it("المسدد اجتاز كل مراحله، والجاري اجتاز اللي قبل مرحلته، والتخطيط بس لمسار C2", () => {
    const rows = stageProgress(
      [
        inv({ status: "paid", category: "C1" }),
        inv({ status: "active", currentStep: "gm", category: "C1" }),
        inv({ status: "active", currentStep: "plan", category: "C2" }),
        inv({ status: "on_hold", currentStep: "exec", heldAt: "exec", suggestedCategory: "C1" }),
        inv({ status: "draft" }),
      ],
      paths,
      order,
    );
    const at = (s: string) => rows.find((r) => r.step === s);
    expect(at("sup")).toEqual({ step: "sup", passed: 4, pending: 0 });
    expect(at("exec")).toEqual({ step: "exec", passed: 3, pending: 1 });
    expect(at("gm")).toEqual({ step: "gm", passed: 2, pending: 2 });
    expect(at("plan")).toEqual({ step: "plan", passed: 0, pending: 1 });
    expect(at("finance")).toEqual({ step: "finance", passed: 1, pending: 3 });
  });
});

describe("levels and gauges", () => {
  it("مستويات الألوان", () => {
    expect([levelOf(null), levelOf(10), levelOf(25), levelOf(60), levelOf(75), levelOf(130)]).toEqual(["none", "cr", "wa", "in", "ok", "ok"]);
  });
  it("المؤشر محصور بين 0 و100", () => {
    expect(gaugePct(150, 100)).toBe(100);
    expect(gaugePct(5, 0)).toBe(0);
    expect(gaugePct(25, 100)).toBe(25);
  });
});
