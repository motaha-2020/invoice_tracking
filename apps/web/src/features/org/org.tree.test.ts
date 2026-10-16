import { describe, expect, it } from "vitest";
import { dependentsMessage } from "./org.kinds";
import { parseOrgInput } from "./org.schema";
import { buildIndex, nodeKey, pathOf, rollupCounts, visibleKeys, type FlatNode } from "./org.tree";

const nodes: FlatNode[] = [
  { kind: "presidency", id: "p1", code: "P1", name: "رئاسة", parentId: null },
  { kind: "sector", id: "s1", code: "S1", name: "قطاع", parentId: "p1" },
  { kind: "techUnit", id: "t1", code: "T1", name: "فنية", parentId: "s1" },
  { kind: "generalDept", id: "g1", code: "G1", name: "عامة", parentId: "s1" },
  { kind: "dept", id: "d1", code: "D1", name: "مختصة", parentId: "g1" },
  { kind: "central", id: "c1", code: "C1", name: "سنترال العريش", parentId: "d1" },
  { kind: "central", id: "c2", code: "C2", name: "سنترال رابعة", parentId: "d1" },
];

describe("org.tree", () => {
  it("المسار من الرئاسة للسنترال، والشئون الفنية قبل الإدارات العامة", () => {
    const idx = buildIndex(nodes);
    expect(pathOf(idx, "central", "c1").map((n) => n.code)).toEqual(["P1", "S1", "G1", "D1", "C1"]);
    expect(idx.roots.map((r) => r.id)).toEqual(["p1"]);
    expect(idx.children.get(nodeKey("sector", "s1"))!.map((n) => n.kind)).toEqual(["techUnit", "generalDept"]);
  });

  it("العدّادات بتتجمع لفوق، والشئون الفنية صفر", () => {
    const c = rollupCounts(
      nodes,
      new Map([
        ["c1", { projects: 2, invoices: 5 }],
        ["c2", { projects: 1, invoices: 1 }],
      ]),
    );
    expect(c.get("dept:d1")).toEqual({ projects: 3, invoices: 6 });
    expect(c.get("presidency:p1")).toEqual({ projects: 3, invoices: 6 });
    expect(c.get("techUnit:t1")).toEqual({ projects: 0, invoices: 0 });
  });

  it("البحث بيرجع العقدة وأجدادها بس", () => {
    const idx = buildIndex(nodes);
    expect(visibleKeys(idx, "")).toBeNull();
    expect([...visibleKeys(idx, "رابعة")!].sort()).toEqual(["central:c2", "dept:d1", "generalDept:g1", "presidency:p1", "sector:s1"]);
    expect(visibleKeys(idx, "c1")!.has("central:c1")).toBe(true);
  });
});

describe("dependentsMessage", () => {
  it("null لو مفيش حاجة تحته", () => {
    expect(dependentsMessage("sector", "x", [{ label: "إدارة عامة", n: 0 }])).toBeNull();
  });

  it("بيعدّد اللي تحته بس، وبالمؤنث للشركة", () => {
    const m = dependentsMessage("company", "بريدج", [
      { label: "عقد", n: 2 },
      { label: "صلاحية مستخدم على النطاق", n: 0 },
    ])!;
    expect(m).toContain("«بريدج»");
    expect(m).toContain("تابعة لها");
    expect(m).toContain("2 عقد");
    expect(m).not.toContain("صلاحية");
  });
});

describe("parseOrgInput", () => {
  it("الإضافة: الكود بيتوحد وإلزامي", () => {
    const r = parseOrgInput("sector", { code: " s-east ", name: "الشرقية", presidencyId: "p1" }, true);
    expect(r).toMatchObject({ ok: true, code: "S-EAST", data: { kind: "sector", fields: { name: "الشرقية", presidencyId: "p1" } } });
    const bad = parseOrgInput("sector", { code: "", name: "", presidencyId: "" }, true);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.fieldErrors).sort()).toEqual(["code", "name", "presidencyId"]);
  });

  it("التعديل: الكود بيتجاهل (مش بيتغير)", () => {
    const r = parseOrgInput("presidency", { code: "NEW", name: "اسم" }, false);
    expect(r).toMatchObject({ ok: true, code: null });
    if (r.ok) expect(r.data.fields).not.toHaveProperty("code");
  });

  it("المشروع: التاريخ والملاحظات اختيارية، والتاريخ الغلط مرفوض", () => {
    const r = parseOrgInput("project", { name: "م", typeId: "t", centralId: "c", startDate: "", notes: "" }, false);
    expect(r.ok && r.data.kind === "project" && r.data.fields).toMatchObject({ startDate: null, notes: null });
    expect(parseOrgInput("project", { name: "م", typeId: "t", centralId: "c", startDate: "2026-13-01" }, false).ok).toBe(false);
  });

  it("الشركة: الإيميل إلزامي وصح", () => {
    expect(parseOrgInput("company", { name: "a", fullName: "b", email: "x" }, false).ok).toBe(false);
    const r = parseOrgInput("company", { name: "a", fullName: "b", email: "X@Y.com" }, false);
    expect(r.ok && r.data.kind === "company" && r.data.fields.email).toBe("x@y.com");
  });
});
