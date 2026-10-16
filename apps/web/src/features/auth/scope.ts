/**
 * النطاق — المكان الوحيد اللي بيبني الـ Prisma `where` للمستخلصات حسب أدوار ونطاقات المستخدم.
 * دوال صافية (من غير DB ولا Next) عشان تتختبر بـ vitest.
 *
 * TODO(@it/domain): منطق inScope/canAct الصافي بيتبني في packages/domain. لما يخلص،
 * الدوال اللي هنا تفضل هي اللي بتترجم القاعدة لـ Prisma where، وتتختبر ضد نفس الحالات.
 */
import type { Prisma, Role } from "@it/db";
import type { RoleScope, SessionUser } from "./auth.types";

type Where = Prisma.InvoiceWhereInput;

/** where مستحيل يطابق حاجة — لمستخدم مالوش نطاق */
export const DENY_ALL: Where = { id: { in: [] } };

/**
 * شرط نطاق واحد. الهيكل: مستخلص ← أمر تكليف ← مشروع ← سنترال ← إدارة ← إدارة عامة ← قطاع ← رئاسة،
 * والشركة من العقد. بيرجع null لو النطاق ناقص id (بيانات غلط = مفيش صلاحية).
 */
export function scopeClause(rs: RoleScope): Where | null {
  if (rs.scopeType === "all") return {};
  const id = rs.scopeId;
  if (!id) return null;
  switch (rs.scopeType) {
    case "company":
      return { contract: { companyId: id } };
    case "central":
      return { ao: { project: { centralId: id } } };
    case "dept":
      return { ao: { project: { central: { deptId: id } } } };
    case "general_dept":
      return { ao: { project: { central: { dept: { generalDeptId: id } } } } };
    case "sector":
      return { ao: { project: { central: { dept: { generalDept: { sectorId: id } } } } } };
    case "presidency":
      return { ao: { project: { central: { dept: { generalDept: { sector: { presidencyId: id } } } } } } };
    default:
      return null;
  }
}

/** OR بين شروط، مع إزالة التكرار وتبسيط الحالات البسيطة */
function anyOf(clauses: Where[]): Where {
  if (clauses.length === 0) return DENY_ALL;
  if (clauses.some(isEmpty)) return {};
  const unique = dedupe(clauses);
  return unique.length === 1 ? unique[0]! : { OR: unique };
}

function isEmpty(w: Where): boolean {
  return Object.keys(w).length === 0;
}

function dedupe(clauses: Where[]): Where[] {
  const seen = new Set<string>();
  return clauses.filter((c) => {
    const k = JSON.stringify(c);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function allOf(a: Where, b: Where): Where {
  if (isEmpty(a)) return b;
  if (isEmpty(b)) return a;
  return { AND: [a, b] };
}

/**
 * نطاق المستخدم التنظيمي بس: all ← {}، أكتر من نطاق ← OR، مفيش نطاق ← DENY_ALL.
 * كل repo بيقرا مستخلصات لازم يبدأ من هنا (أو من visibleInvoicesWhere).
 */
export function scopeWhere(user: Pick<SessionUser, "roles">): Where {
  const clauses = user.roles.map(scopeClause).filter((c): c is Where => c !== null);
  return anyOf(clauses);
}

/**
 * المستخلصات اللي المستخدم يشوفها في القوائم: نطاقه، والمسودات بتظهر بس من خلال نطاق شركة
 * (الشركة بتشوف مسوداتها، والإدارات ما تشوفش مسودات لسه ما اتقدمتش).
 */
export function visibleInvoicesWhere(user: Pick<SessionUser, "roles">): Where {
  const clauses: Where[] = [];
  for (const rs of user.roles) {
    const c = scopeClause(rs);
    if (c === null) continue;
    // المسودات بتظهر للمقاول، ولمدير النظام (بيقدّم نيابةً عن المقاول)
    clauses.push(rs.role === "company" || rs.role === "admin" ? c : allOf(c, { status: { not: "draft" } }));
  }
  return anyOf(clauses);
}

/** خريطة المحطة ← الدور المسؤول (من جدول workflow_steps) */
export type StepRoleMap = Readonly<Record<string, Role>>;

/**
 * صندوق الوارد: المستخلصات اللي الدور عليها دلوقتي للمستخدم ده.
 * - جاري (active) والمحطة الحالية بتاعة دوره
 * - مرتجع لمحطة بتاعة دوره
 * - للشركة: المرتجع للشركة والمسودات
 * وكل ده جوه نطاق نفس الدور (مستخدم بأكتر من دور: كل دور بنطاقه).
 */
export function inboxWhere(user: Pick<SessionUser, "roles">, stepRoles: StepRoleMap): Where {
  const clauses: Where[] = [];
  for (const rs of user.roles) {
    const scope = scopeClause(rs);
    if (scope === null) continue;
    const steps = Object.keys(stepRoles)
      .filter((k) => stepRoles[k] === rs.role)
      .sort();
    const conds: Where[] = [];
    if (steps.length > 0) {
      conds.push({ status: "active", currentStep: { in: steps } });
      conds.push({ status: "returned", returnTo: { in: steps } });
    }
    if (rs.role === "company") {
      conds.push({ status: "returned", returnTo: "company" });
      conds.push({ status: "draft" });
    }
    if (conds.length === 0) continue;
    const turn = conds.length === 1 ? conds[0]! : { OR: conds };
    clauses.push(allOf(scope, turn));
  }
  return clauses.length === 0 ? DENY_ALL : anyOf(clauses);
}

export function hasRole(user: Pick<SessionUser, "roles">, ...roles: Role[]): boolean {
  return user.roles.some((r) => roles.includes(r.role));
}

/** الدور الأساسي للعرض (أول صف) */
export function primaryRole(user: Pick<SessionUser, "roles">): RoleScope | undefined {
  return user.roles[0];
}
