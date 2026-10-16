import { describe, expect, it } from "vitest";
import type { RawRow } from "../imports/import.types";
import { emptyExistingOrg, validateOrgSheets, type ExistingNode, type ExistingOrg } from "./org-import.rules";
import type { OrgLevel } from "./org.kinds";

let n = 3;
const row = (v: Record<string, unknown>): RawRow => ({ __row: n++, ...v });
const existingWith = (entries: [OrgLevel, string, ExistingNode][]): ExistingOrg => {
  const e = emptyExistingOrg();
  for (const [level, code, node] of entries) (e[level] as Map<string, ExistingNode>).set(code, node);
  return e;
};

describe("validateOrgSheets — ترتيب الأب ← الابن", () => {
  it("الأب في نفس الملف (صف سليم) يكفي", () => {
    const rows = validateOrgSheets(
      {
        "رئاسات القطاعات": [row({ code: "pr-1", name: "رئاسة 1" })],
        القطاعات: [row({ code: "S-1", presidency_code: "PR-1", name: "قطاع 1" })],
        "الإدارات العامة": [row({ code: "G-1", sector_code: "s-1", name: "عامة 1" })],
        "الشئون الفنية": [row({ code: "TA-1", sector_code: "S-1", name: "فنية 1" })],
        "الإدارات المختصة": [row({ code: "D-1", gdept_code: "G-1", name: "مختصة 1" })],
        السنترالات: [row({ code: "C-1", dept_code: "D-1", name: "سنترال 1" })],
      },
      emptyExistingOrg(),
    );
    expect(rows.map((r) => r.status)).toEqual(["create", "create", "create", "create", "create", "create"]);
    expect(rows[0]!.data).toMatchObject({ level: "presidency", code: "PR-1", parentCode: null });
    expect(rows[2]!.data).toMatchObject({ level: "generalDept", parentCode: "S-1" });
  });

  it("الأب من المنظومة (DB) يكفي", () => {
    const existing = existingWith([["dept", "D-9", { name: "x", parentCode: "G-9" }]]);
    const [r] = validateOrgSheets({ السنترالات: [row({ code: "C-2", dept_code: "D-9", name: "سنترال" })] }, existing);
    expect(r!.status).toBe("create");
  });

  it("أب مش موجود في أي مكان ← خطأ", () => {
    const [r] = validateOrgSheets({ القطاعات: [row({ code: "S-2", presidency_code: "NOPE", name: "قطاع" })] }, emptyExistingOrg());
    expect(r!.status).toBe("error");
    expect(r!.errors[0]).toContain("NOPE");
    expect(r!.data).toBeUndefined();
  });

  it("أب في الملف بس فيه أخطاء ← الابن خطأ برسالة واضحة", () => {
    const rows = validateOrgSheets(
      {
        "رئاسات القطاعات": [row({ code: "PR-X", name: "" })],
        القطاعات: [row({ code: "S-3", presidency_code: "PR-X", name: "قطاع" })],
      },
      emptyExistingOrg(),
    );
    expect(rows[0]!.status).toBe("error");
    expect(rows[1]!.status).toBe("error");
    expect(rows[1]!.errors.join()).toContain("تتضمن أخطاء في الملف");
  });

  it("أب فيه خطأ في الملف بس موجود في المنظومة ← الابن سليم", () => {
    const rows = validateOrgSheets(
      {
        "رئاسات القطاعات": [row({ code: "PR-Y", name: "" })],
        القطاعات: [row({ code: "S-4", presidency_code: "PR-Y", name: "قطاع" })],
      },
      existingWith([["presidency", "PR-Y", { name: "y", parentCode: null }]]),
    );
    expect(rows[1]!.status).toBe("create");
  });

  it("كود الأب فاضي ← خطأ إلزامي", () => {
    const [r] = validateOrgSheets({ "الإدارات المختصة": [row({ code: "D-2", name: "x" })] }, emptyExistingOrg());
    expect(r!.errors).toContain("كود إدارة عامة إلزامي");
  });
});

describe("validateOrgSheets — تكرار وتحديث", () => {
  it("الكود المتكرر في نفس الشيت: التاني بس خطأ", () => {
    const rows = validateOrgSheets(
      { "رئاسات القطاعات": [row({ code: "PR-1", name: "أ" }), row({ code: "pr-1 ", name: "ب" })] },
      emptyExistingOrg(),
    );
    expect(rows[0]!.status).toBe("create");
    expect(rows[1]!.status).toBe("error");
    expect(rows[1]!.errors[0]).toContain("مكرر");
  });

  it("نفس الكود في مستويين مختلفين مش تكرار", () => {
    const rows = validateOrgSheets(
      {
        "رئاسات القطاعات": [row({ code: "X1", name: "أ" })],
        القطاعات: [row({ code: "X1", presidency_code: "X1", name: "ب" })],
      },
      emptyExistingOrg(),
    );
    expect(rows.every((r) => r.status === "create")).toBe(true);
  });

  it("موجود باسم مختلف ← update، بنفس الاسم ← skip", () => {
    const existing = existingWith([
      ["presidency", "PR-1", { name: "قديم", parentCode: null }],
      ["presidency", "PR-2", { name: "زي ما هو", parentCode: null }],
    ]);
    const rows = validateOrgSheets(
      { "رئاسات القطاعات": [row({ code: "PR-1", name: "جديد" }), row({ code: "PR-2", name: "زي ما هو" })] },
      existing,
    );
    expect(rows.map((r) => r.status)).toEqual(["update", "skip"]);
  });

  it("موجود تحت أب تاني ← تحذير إن الاسم بس هيتحدث", () => {
    const existing = existingWith([
      ["presidency", "PR-A", { name: "a", parentCode: null }],
      ["presidency", "PR-B", { name: "b", parentCode: null }],
      ["sector", "S-1", { name: "قطاع", parentCode: "PR-A" }],
    ]);
    const [r] = validateOrgSheets({ القطاعات: [row({ code: "S-1", presidency_code: "PR-B", name: "قطاع جديد" })] }, existing);
    expect(r!.status).toBe("update");
    expect(r!.warnings.join()).toContain("PR-A");
  });

  it("كود فيه رموز ممنوعة ← خطأ", () => {
    const [r] = validateOrgSheets({ "رئاسات القطاعات": [row({ code: "PR#1", name: "x" })] }, emptyExistingOrg());
    expect(r!.status).toBe("error");
  });
});

describe("validateOrgSheets — المدير العام وصفوف المثال", () => {
  it("إيميل المدير العام لمستخدم موجود بيتربط، وغير موجود تحذير، ومش إيميل خطأ", () => {
    const existing = existingWith([["sector", "S-1", { name: "s", parentCode: "P" }]]);
    const users = new Map([["gm@te.eg", { id: "u1", name: "مدير" }]]);
    const rows = validateOrgSheets(
      {
        "الإدارات العامة": [
          row({ code: "G-1", sector_code: "S-1", name: "أ", gm_email: "GM@te.eg" }),
          row({ code: "G-2", sector_code: "S-1", name: "ب", gm_email: "x@te.eg" }),
          row({ code: "G-3", sector_code: "S-1", name: "ج", gm_email: "مش إيميل" }),
        ],
      },
      existing,
      users,
    );
    expect(rows[0]!.data?.gmUserId).toBe("u1");
    expect(rows[1]!.status).toBe("create");
    expect(rows[1]!.warnings[0]).toContain("x@te.eg");
    expect(rows[2]!.status).toBe("error");
  });

  it("صف المثال من القالب بياخد تحذير", () => {
    const [r] = validateOrgSheets(
      { "رئاسات القطاعات": [row({ code: "PR-DELTA", name: "رئاسة قطاعات الدلتا والقناة" })] },
      emptyExistingOrg(),
    );
    expect(r!.warnings.join()).toContain("المثال");
  });
});
