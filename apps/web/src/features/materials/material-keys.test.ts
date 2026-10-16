import { describe, expect, it } from "vitest";
import type { RoleScope } from "../auth/auth.types";
import { AO_DENY_ALL, aoScopeWhere, invoiceWhereToAoWhere } from "./ao-scope";
import { materialCode, normalizeAoNo, normalizeContractNo } from "./material-keys";

describe("normalizeAoNo", () => {
  it.each([
    ["25", "PO25"],
    [25, "PO25"],
    ["PO 25", "PO25"],
    ["po25", "PO25"],
    ["PO-25", "PO25"],
    ["PO025", "PO25"],
    ["1", "PO01"],
    ["PO1", "PO01"],
    ["PO01", "PO01"],
    ["٢٥", "PO25"],
  ])("%s ← %s", (input, out) => {
    expect(normalizeAoNo(input)).toBe(out);
  });

  it("الأشكال التانية بتتوحّد بس", () => {
    expect(normalizeAoNo(" wo-0012 ")).toBe("WO-0012");
    expect(normalizeAoNo("")).toBe("");
  });
});

describe("normalizeContractNo", () => {
  it("بيشيل المسافات ويحوّل الأرقام", () => {
    expect(normalizeContractNo(" 232 / 2025 / 1 / 36 ")).toBe("232/2025/1/36");
    expect(normalizeContractNo("٢٣١/٢٠٢٦/١/١٢")).toBe("231/2026/1/12");
  });
});

describe("materialCode", () => {
  it("زي ما هو بالنقط", () => {
    expect(materialCode(" 1.1.7 ")).toBe("1.1.7");
    expect(materialCode("ZZ.9")).toBe("ZZ.9");
  });
});

describe("aoScopeWhere", () => {
  const u = (...roles: RoleScope[]) => ({ roles });

  it("all ← {}", () => {
    expect(aoScopeWhere(u({ role: "stores", scopeType: "all", scopeId: null }))).toEqual({});
  });

  it("سنترال ← شرط المشروع على أمر التكليف مباشرة", () => {
    expect(aoScopeWhere(u({ role: "tech_affairs", scopeType: "central", scopeId: "c1" }))).toEqual({ project: { centralId: "c1" } });
  });

  it("شركة ← عن طريق العقد", () => {
    expect(aoScopeWhere(u({ role: "company", scopeType: "company", scopeId: "co1" }))).toEqual({ contract: { companyId: "co1" } });
  });

  it("أكتر من نطاق ← OR", () => {
    expect(
      aoScopeWhere(u({ role: "stores", scopeType: "sector", scopeId: "s1" }, { role: "stores", scopeType: "central", scopeId: "c2" })),
    ).toEqual({
      OR: [{ project: { central: { dept: { generalDept: { sectorId: "s1" } } } } }, { project: { centralId: "c2" } }],
    });
  });

  it("مفيش نطاق ← ممنوع", () => {
    expect(aoScopeWhere(u())).toEqual(AO_DENY_ALL);
    expect(aoScopeWhere(u({ role: "stores", scopeType: "sector", scopeId: null }))).toEqual(AO_DENY_ALL);
  });

  it("مفتاح مش متوقع ← ممنوع", () => {
    expect(invoiceWhereToAoWhere({ status: "paid" })).toEqual(AO_DENY_ALL);
    expect(invoiceWhereToAoWhere({ AND: [{ ao: { id: "a" } }, { status: "paid" }] })).toEqual({ AND: [{ id: "a" }, AO_DENY_ALL] });
  });
});
