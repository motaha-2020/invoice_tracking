import { describe, expect, it } from "vitest";
import type { RoleScope } from "./auth.types";
import { DENY_ALL, inboxWhere, scopeClause, scopeWhere, visibleInvoicesWhere, type StepRoleMap } from "./scope";
import { hasPermission } from "./permission-rules";
import { safeNextPath } from "./auth.schema";
import { RateLimiter } from "./rate-limit";

const u = (...roles: RoleScope[]) => ({ roles });

describe("scopeClause", () => {
  it("all → {}", () => {
    expect(scopeClause({ role: "pmo", scopeType: "all", scopeId: null })).toEqual({});
  });

  it("company → عن طريق العقد", () => {
    expect(scopeClause({ role: "company", scopeType: "company", scopeId: "co1" })).toEqual({ contract: { companyId: "co1" } });
  });

  it("الهيكل كله: central → presidency", () => {
    expect(scopeClause({ role: "supervisor", scopeType: "central", scopeId: "c1" })).toEqual({ ao: { project: { centralId: "c1" } } });
    expect(scopeClause({ role: "exec_mgr", scopeType: "dept", scopeId: "d1" })).toEqual({ ao: { project: { central: { deptId: "d1" } } } });
    expect(scopeClause({ role: "gm", scopeType: "general_dept", scopeId: "g1" })).toEqual({
      ao: { project: { central: { dept: { generalDeptId: "g1" } } } },
    });
    expect(scopeClause({ role: "sector_head", scopeType: "sector", scopeId: "s1" })).toEqual({
      ao: { project: { central: { dept: { generalDept: { sectorId: "s1" } } } } },
    });
    expect(scopeClause({ role: "presidency_head", scopeType: "presidency", scopeId: "p1" })).toEqual({
      ao: { project: { central: { dept: { generalDept: { sector: { presidencyId: "p1" } } } } } },
    });
  });

  it("نطاق من غير id → null (مفيش صلاحية)", () => {
    expect(scopeClause({ role: "exec_mgr", scopeType: "dept", scopeId: null })).toBeNull();
  });
});

describe("scopeWhere", () => {
  it("مفيش أدوار → DENY_ALL", () => {
    expect(scopeWhere(u())).toEqual(DENY_ALL);
  });

  it("نطاق واحد → الشرط نفسه من غير OR", () => {
    expect(scopeWhere(u({ role: "exec_mgr", scopeType: "dept", scopeId: "d1" }))).toEqual({
      ao: { project: { central: { deptId: "d1" } } },
    });
  });

  it("أكتر من نطاق → OR", () => {
    expect(
      scopeWhere(
        u({ role: "exec_mgr", scopeType: "dept", scopeId: "d1" }, { role: "exec_mgr", scopeType: "dept", scopeId: "d2" }),
      ),
    ).toEqual({
      OR: [{ ao: { project: { central: { deptId: "d1" } } } }, { ao: { project: { central: { deptId: "d2" } } } }],
    });
  });

  it("all مع أي نطاق تاني → {}", () => {
    expect(
      scopeWhere(u({ role: "gm", scopeType: "general_dept", scopeId: "g1" }, { role: "pmo", scopeType: "all", scopeId: null })),
    ).toEqual({});
  });

  it("التكرار بيتشال (نفس النطاق بدورين)", () => {
    expect(
      scopeWhere(u({ role: "gm", scopeType: "sector", scopeId: "s1" }, { role: "stores", scopeType: "sector", scopeId: "s1" })),
    ).toEqual({ ao: { project: { central: { dept: { generalDept: { sectorId: "s1" } } } } } });
  });

  it("نطاق ناقص بيتجاهل، ولو هو الوحيد → DENY_ALL", () => {
    expect(scopeWhere(u({ role: "gm", scopeType: "sector", scopeId: null }))).toEqual(DENY_ALL);
  });
});

describe("visibleInvoicesWhere", () => {
  it("الشركة بتشوف مسوداتها", () => {
    expect(visibleInvoicesWhere(u({ role: "company", scopeType: "company", scopeId: "co1" }))).toEqual({
      contract: { companyId: "co1" },
    });
  });

  it("الإدارات ما تشوفش المسودات", () => {
    expect(visibleInvoicesWhere(u({ role: "exec_mgr", scopeType: "dept", scopeId: "d1" }))).toEqual({
      AND: [{ ao: { project: { central: { deptId: "d1" } } } }, { status: { not: "draft" } }],
    });
    expect(visibleInvoicesWhere(u({ role: "pmo", scopeType: "all", scopeId: null }))).toEqual({ status: { not: "draft" } });
  });
});

describe("inboxWhere", () => {
  const steps: StepRoleMap = { sup: "supervisor", exec: "exec_mgr", gm: "gm", finance: "finance" };

  it("مدير التنفيذ: محطة exec (جاري أو مرتجع) جوه إدارته", () => {
    expect(inboxWhere(u({ role: "exec_mgr", scopeType: "dept", scopeId: "d1" }), steps)).toEqual({
      AND: [
        { ao: { project: { central: { deptId: "d1" } } } },
        {
          OR: [
            { status: "active", currentStep: { in: ["exec"] } },
            { status: "returned", returnTo: { in: ["exec"] } },
          ],
        },
      ],
    });
  });

  it("المالية بنطاق all: من غير شرط نطاق", () => {
    expect(inboxWhere(u({ role: "finance", scopeType: "all", scopeId: null }), steps)).toEqual({
      OR: [
        { status: "active", currentStep: { in: ["finance"] } },
        { status: "returned", returnTo: { in: ["finance"] } },
      ],
    });
  });

  it("الشركة: المرتجع للشركة والمسودات بتاعتها", () => {
    expect(inboxWhere(u({ role: "company", scopeType: "company", scopeId: "co1" }), steps)).toEqual({
      AND: [{ contract: { companyId: "co1" } }, { OR: [{ status: "returned", returnTo: "company" }, { status: "draft" }] }],
    });
  });

  it("دور مالوش محطة (pmo) → DENY_ALL", () => {
    expect(inboxWhere(u({ role: "pmo", scopeType: "all", scopeId: null }), steps)).toEqual(DENY_ALL);
  });

  it("دورين بنطاقين: كل دور بنطاقه", () => {
    const w = inboxWhere(
      u({ role: "supervisor", scopeType: "dept", scopeId: "d1" }, { role: "gm", scopeType: "general_dept", scopeId: "g1" }),
      steps,
    );
    expect(w.OR).toHaveLength(2);
  });
});

describe("hasPermission", () => {
  it("الـ defaults لما الجدول فاضي", () => {
    expect(hasPermission(["admin"], "users.manage", [])).toBe(true);
    expect(hasPermission(["pmo"], "users.manage", null)).toBe(false);
  });

  it("الجدول بيغلب على الـ defaults", () => {
    const rows = [{ role: "pmo" as const, permission: "users.manage" }];
    expect(hasPermission(["pmo"], "users.manage", rows)).toBe(true);
    expect(hasPermission(["admin"], "users.manage", rows)).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("بيرفض الروابط الخارجية", () => {
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("/invoices?status=active")).toBe("/invoices?status=active");
    expect(safeNextPath("/login")).toBe("/");
  });
});

describe("RateLimiter", () => {
  it("بيقفل بعد الحد وبيفتح بعد الـ window", () => {
    let t = 0;
    const rl = new RateLimiter(2, 1000, () => t);
    rl.hit("k");
    expect(rl.isBlocked("k")).toBe(false);
    rl.hit("k");
    expect(rl.isBlocked("k")).toBe(true);
    t = 1001;
    expect(rl.isBlocked("k")).toBe(false);
  });
});
