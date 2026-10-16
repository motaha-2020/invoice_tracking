import { describe, expect, it } from "vitest";
import { addendumMode, checkBoqHierarchy, checkPaymentTerms, contractsScopeWhere, itemLevel, normalizeAoNo, parentOf, termsSummary } from "./contracts.rules";

describe("normalizeAoNo", () => {
  it.each([
    ["PO25", "PO25"],
    ["25", "PO25"],
    [25, "PO25"],
    ["po 25", "PO25"],
    ["PO-25", "PO25"],
    ["٢٥", "PO25"],
    ["5", "PO05"],
    ["PO005", "PO05"],
    ["PO123", "PO123"],
  ])("%s ← %s", (input, out) => {
    expect(normalizeAoNo(input)).toBe(out);
  });

  it("فاضي ← ''", () => {
    expect(normalizeAoNo(null)).toBe("");
    expect(normalizeAoNo("  ")).toBe("");
  });

  it("شكل مش معروف بيرجع متنضف", () => {
    expect(normalizeAoNo("ao 7b")).toBe("AO7B");
  });
});

describe("checkPaymentTerms", () => {
  it("70 / 20 / 10 = 100", () => {
    expect(checkPaymentTerms(70, 20, 10)).toEqual({ ok: true, sum: 100 });
  });
  it("90 / فاضي / 10 = 100 (الفاضي صفر)", () => {
    expect(checkPaymentTerms(90, null, 10).ok).toBe(true);
  });
  it("الكسور بالقروش: 33.33 + 33.33 + 33.34", () => {
    expect(checkPaymentTerms(33.33, 33.33, 33.34).ok).toBe(true);
  });
  it("70 / 20 / 0 ← خطأ برسالة فيها المجموع", () => {
    const r = checkPaymentTerms(70, 20, 0);
    expect(r.ok).toBe(false);
    expect(r.sum).toBe(90);
    if (!r.ok) expect(r.message).toContain("90%");
  });
  it("أكتر من 100 ← خطأ", () => {
    expect(checkPaymentTerms(90, 20, 10).ok).toBe(false);
  });
});

describe("termsSummary", () => {
  it("232: 70 / 20 / 10", () => {
    expect(termsSummary({ payMonthlyPct: 70, payAsbuiltPct: 20, payHandoverPct: 10 })).toBe("70% / 20% As-Built / 10% استلام ابتدائي");
  });
  it("231: 90 / 0 / 10 — من غير As-Built", () => {
    expect(termsSummary({ payMonthlyPct: 90, payAsbuiltPct: 0, payHandoverPct: 10 })).toBe("90% / 10% استلام ابتدائي");
  });
});

describe("تدرج المقايسة", () => {
  it("parentOf / itemLevel", () => {
    expect(parentOf("1-1-1-2")).toBe("1-1-1");
    expect(parentOf("1")).toBeNull();
    expect(itemLevel("1")).toBe(1);
    expect(itemLevel("1-1-1-9-2")).toBe(5);
    expect(itemLevel("N-1")).toBe(1);
  });

  it("ملف سليم ← مفيش مشاكل", () => {
    const rows = ["1", "1-1", "1-1-1", "1-1-1-1", "2", "2-1"].map((itemNo, i) => ({ row: i + 3, itemNo }));
    expect(checkBoqHierarchy(rows).size).toBe(0);
  });

  it("التكرار = خطأ على التكرار التاني بس", () => {
    const rows = [
      { row: 3, itemNo: "1" },
      { row: 4, itemNo: "1-1" },
      { row: 5, itemNo: "1-1" },
    ];
    const r = checkBoqHierarchy(rows);
    expect(r.has(4)).toBe(false);
    expect(r.get(5)!.errors[0]).toContain("صف 4");
  });

  it("الأب الناقص = تحذير، إلا لو موجود في المقايسة المسجلة", () => {
    const rows = [{ row: 3, itemNo: "1-9-1" }];
    expect(checkBoqHierarchy(rows).get(3)!.warnings[0]).toContain("1-9");
    expect(checkBoqHierarchy(rows, new Set(["1-9"])).size).toBe(0);
  });

  it("البند المستجد N-1 مالوش أب مطلوب", () => {
    expect(checkBoqHierarchy([{ row: 3, itemNo: "N-1" }]).size).toBe(0);
  });
});

describe("addendumMode", () => {
  it("قيمة الملف ≈ الزيادة ← add", () => {
    expect(addendumMode(13_500_000, 13_536_865.5, 41_800_000)).toBe("add");
  });
  it("قيمة الملف ≈ الإجمالي الجديد ← replace", () => {
    expect(addendumMode(41_500_000, 13_536_865.5, 41_800_000)).toBe("replace");
  });
  it("مفيش أرقام ← add", () => {
    expect(addendumMode(1000, null, null)).toBe("add");
    expect(addendumMode(0, 10, 20)).toBe("add");
  });
});

describe("contractsScopeWhere", () => {
  it("دور داخلي ← كل العقود", () => {
    expect(contractsScopeWhere({ roles: [{ role: "exec_mgr", scopeType: "dept", scopeId: "d1" }] })).toEqual({});
  });
  it("شركة ← عقودها بس", () => {
    expect(contractsScopeWhere({ roles: [{ role: "company", scopeType: "company", scopeId: "co1" }] })).toEqual({ companyId: { in: ["co1"] } });
  });
  it("مفيش أدوار ← ولا عقد", () => {
    expect(contractsScopeWhere({ roles: [] })).toEqual({ id: { in: [] } });
  });
});
