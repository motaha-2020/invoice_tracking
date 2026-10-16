import { describe, expect, it } from "vitest";
import {
  buildScopeLookup,
  defaultScopeType,
  effectiveMatrix,
  groupImportRows,
  keepsUsersManage,
  normalizeRoleScopes,
  parseScopeType,
  planPermissionToggle,
  resolveScopeCode,
} from "./users.rules";

const lookup = buildScopeLookup({
  company: [{ id: "co1", code: "CO-BRIDGE", name: "بريدج" }],
  presidency: [{ id: "p1", code: "P-CANAL", name: "رئاسة القناة" }],
  sector: [{ id: "s1", code: "S-SINAI", name: "سيناء" }],
  general_dept: [{ id: "g1", code: "G-NORTH", name: "شمال سيناء" }],
  dept: [{ id: "d1", code: "D-ARISH", name: "العريش" }],
  central: [{ id: "c1", code: "C-ARISH1", name: "سنترال العريش" }],
});

describe("نوع النطاق", () => {
  it("بيقبل gdept من القالب والعربي", () => {
    expect(parseScopeType("gdept")).toBe("general_dept");
    expect(parseScopeType(" DEPT ")).toBe("dept");
    expect(parseScopeType("قطاع")).toBe("sector");
    expect(parseScopeType("كل الجهات")).toBe("all");
    expect(parseScopeType("xyz")).toBeNull();
    expect(parseScopeType("")).toBeNull();
  });

  it("النطاق الافتراضي من ROLE_DEFAULT_SCOPE", () => {
    expect(defaultScopeType("exec_mgr")).toBe("dept");
    expect(defaultScopeType("gm")).toBe("general_dept");
    expect(defaultScopeType("pmo")).toBe("all");
    expect(defaultScopeType("company")).toBe("company");
  });
});

describe("resolveScopeCode", () => {
  it("كود ← كيان حسب النوع (من غير حساسية لحالة الحروف والمسافات)", () => {
    expect(resolveScopeCode(lookup, "dept", " d-arish ").value).toEqual({ id: "d1", code: "D-ARISH", name: "العريش" });
    expect(resolveScopeCode(lookup, "general_dept", "G-NORTH").value?.id).toBe("g1");
  });

  it("all مالوش كيان حتى لو فيه كود", () => {
    expect(resolveScopeCode(lookup, "all", "ANY")).toEqual({ value: null });
  });

  it("كود في نوع غلط = خطأ", () => {
    expect(resolveScopeCode(lookup, "sector", "D-ARISH").error).toMatch(/غير موجود/);
  });

  it("كود فاضي لنطاق محتاج كيان = خطأ", () => {
    expect(resolveScopeCode(lookup, "company", "").error).toMatch(/إلزامي/);
  });
});

describe("normalizeRoleScopes", () => {
  it("all بيشيل الـ id، والتكرار بيتشال", () => {
    const r = normalizeRoleScopes([
      { role: "pmo", scopeType: "all", scopeId: "x" },
      { role: "pmo", scopeType: "all", scopeId: null },
      { role: "exec_mgr", scopeType: "dept", scopeId: "d1" },
    ]);
    expect(r.value).toEqual([
      { role: "pmo", scopeType: "all", scopeId: null },
      { role: "exec_mgr", scopeType: "dept", scopeId: "d1" },
    ]);
  });

  it("نطاق من غير جهة = خطأ، وجهة مش موجودة = خطأ", () => {
    expect(normalizeRoleScopes([{ role: "gm", scopeType: "general_dept", scopeId: null }]).error).toBeTruthy();
    expect(normalizeRoleScopes([{ role: "gm", scopeType: "general_dept", scopeId: "zzz" }], { general_dept: new Set(["g1"]) }).error).toMatch(/غير موجودة/);
    expect(normalizeRoleScopes([]).error).toBeTruthy();
  });
});

describe("groupImportRows", () => {
  it("نفس الإيميل في أكتر من صف = مستخدم واحد بأكتر من نطاق", () => {
    const groups = groupImportRows([
      { email: "a@te.eg", name: "أ", phone: null, role: "exec_mgr", scopeType: "dept", scopeId: "d1" },
      { email: "a@te.eg", name: "أ", phone: "010", role: "exec_mgr", scopeType: "dept", scopeId: "d2" },
      { email: "a@te.eg", name: "أ", phone: null, role: "exec_mgr", scopeType: "dept", scopeId: "d1" },
      { email: "b@te.eg", name: "ب", phone: null, role: "pmo", scopeType: "all", scopeId: null },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ email: "a@te.eg", phone: "010" });
    expect(groups[0]!.roles.map((r) => r.scopeId)).toEqual(["d1", "d2"]);
    expect(groups[1]!.roles).toEqual([{ role: "pmo", scopeType: "all", scopeId: null }]);
  });
});

describe("مصفوفة الصلاحيات", () => {
  it("جدول فاضي = الـ defaults", () => {
    expect(effectiveMatrix([])["users.manage"]).toEqual(["admin"]);
    expect(effectiveMatrix([{ role: "pmo", permission: "users.manage" }])["users.manage"]).toEqual(["pmo"]);
    expect(effectiveMatrix([{ role: "pmo", permission: "users.manage" }])["reports.view"]).toEqual([]);
  });

  it("ممنوع تشيل users.manage من الأدمن", () => {
    expect(planPermissionToggle([], "users.manage", "admin", false).error).toBeTruthy();
    expect(planPermissionToggle([{ role: "admin", permission: "users.manage" }], "users.manage", "admin", false).error).toBeTruthy();
  });

  it("أول تعديل على جدول فاضي بيزرع الـ defaults الأول (عشان باقي الصلاحيات ما تضيعش)", () => {
    const plan = planPermissionToggle([], "reports.export", "planning", true).value!;
    expect(plan.seed.length).toBeGreaterThan(10);
    expect(plan.seed).toContainEqual({ role: "admin", permission: "users.manage" });
    expect(plan.add).toEqual({ role: "planning", permission: "reports.export" });

    const remove = planPermissionToggle([], "reports.view", "company", false).value!;
    expect(remove.remove).toEqual({ role: "company", permission: "reports.view" });
  });

  it("الجدول فيه صفوف: مفيش زرع، وإضافة موجود = ولا حاجة", () => {
    const rows = [{ role: "admin" as const, permission: "users.manage" }];
    expect(planPermissionToggle(rows, "users.manage", "admin", true).value).toEqual({ seed: [] });
    expect(planPermissionToggle(rows, "users.manage", "pmo", true).value).toEqual({ seed: [], add: { role: "pmo", permission: "users.manage" } });
    expect(planPermissionToggle(rows, "reports.view", "pmo", false).value).toEqual({ seed: [] });
  });

  it("keepsUsersManage: حماية الأدمن من إنه يقفل على نفسه", () => {
    expect(keepsUsersManage(["admin"], [])).toBe(true);
    expect(keepsUsersManage(["pmo"], [])).toBe(false);
    expect(keepsUsersManage(["pmo"], [{ role: "pmo", permission: "users.manage" }])).toBe(true);
  });
});
