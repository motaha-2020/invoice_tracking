import "server-only";
import { prisma, type Prisma, type Role } from "@it/db";
import type { PermissionRow } from "@/features/auth/permission-rules";
import type { PermissionPlan, RoleScopeInput } from "./users.rules";
import type { ScopeOptions, UserFilter } from "./users.types";

/** الوصول للداتا الخاص بالمستخدمين والتفويضات والصلاحيات — الطبقة الوحيدة هنا اللي بتكلم Prisma */

type Tx = Prisma.TransactionClient;
type Audit = { userId: string; action: string; entity: string; entityId?: string | null; details?: Prisma.InputJsonValue };

// ── المستخدمين ──────────────────────────────────────────

export async function listUsers(filter: UserFilter) {
  const q = filter.q?.trim();
  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
    ...(filter.role ? { roles: { some: { role: filter.role } } } : {}),
    ...(filter.active ? { active: filter.active === "1" } : {}),
  };
  const now = new Date();
  const rows = await prisma.user.findMany({
    where,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    take: 1000,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      active: true,
      passwordHash: true,
      lastLoginAt: true,
      roles: { select: { role: true, scopeType: true, scopeId: true }, orderBy: { role: "asc" } },
      invites: { where: { usedAt: null, expiresAt: { gt: now }, purpose: "invite" }, select: { id: true }, take: 1 },
    },
  });
  // الـ hash ما يطلعش برّه الـ repo
  return rows.map(({ passwordHash, invites, ...u }) => ({ ...u, hasPassword: passwordHash != null, invitePending: invites.length > 0 }));
}

/** كل الجهات (للاختيار في الفورم ولأسماء النطاقات) */
export async function listScopeOptions(): Promise<ScopeOptions> {
  const sel = { select: { id: true, code: true, name: true }, orderBy: { name: "asc" } } as const;
  const [company, presidency, sector, general_dept, dept, central] = await Promise.all([
    prisma.company.findMany(sel),
    prisma.presidency.findMany(sel),
    prisma.sector.findMany(sel),
    prisma.generalDept.findMany(sel),
    prisma.dept.findMany(sel),
    prisma.central.findMany(sel),
  ]);
  return { company, presidency, sector, general_dept, dept, central };
}

export function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id }, select: { id: true, email: true, active: true } });
}

export function findUserIdByEmail(email: string) {
  return prisma.user.findUnique({ where: { email }, select: { id: true } });
}

export function listUserPicks() {
  return prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } });
}

export function countUsersByRole() {
  return prisma.userRole.groupBy({ by: ["role"], _count: { _all: true } });
}

type UserData = { name: string; email: string; phone: string | null; active: boolean };

export function createUserWithRoles(data: UserData, roles: RoleScopeInput[], audit: Audit) {
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.create({ data: { ...data, roles: { create: roles } }, select: { id: true } });
    await tx.auditLog.create({ data: { ...audit, entityId: u.id } });
    return u;
  });
}

/** بيعدّل البيانات ويكتب الأدوار من جديد. الإيقاف بيمسح الجلسات (يطلع فوراً). */
export function updateUserWithRoles(id: string, data: UserData, roles: RoleScopeInput[], audit: Audit) {
  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data, select: { id: true } });
    await tx.userRole.deleteMany({ where: { userId: id } });
    await tx.userRole.createMany({ data: roles.map((r) => ({ ...r, userId: id })) });
    if (!data.active) await tx.session.deleteMany({ where: { userId: id } });
    await tx.auditLog.create({ data: audit });
  });
}

export function setUserActive(id: string, active: boolean, audit: Audit) {
  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { active }, select: { id: true } });
    if (!active) {
      await tx.session.deleteMany({ where: { userId: id } });
      // دعوة مفتوحة لمستخدم موقوف ما ينفعش تتستخدم
      await tx.inviteToken.updateMany({ where: { userId: id, usedAt: null }, data: { expiresAt: new Date() } });
    }
    await tx.auditLog.create({ data: audit });
  });
}

/** المستخدمين اللي لسه ما اتبعتلهمش دعوة خالص وما حددوش كلمة سر (الجداد بعد الاستيراد) */
export function listNeverInvitedUsers() {
  return prisma.user.findMany({
    where: { active: true, passwordHash: null, invites: { none: {} } },
    orderBy: { name: "asc" },
    take: 500,
    select: { id: true, name: true, email: true },
  });
}

// ── الاستيراد (قالب 04) ─────────────────────────────────

/** المستخدمين الموجودين بالإيميلات دي مع أدوارهم — للمعاينة */
export function findUsersByEmails(emails: string[]) {
  return prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true, roles: { select: { role: true, scopeType: true, scopeId: true } } },
  });
}

export function emailsExist(emails: string[]) {
  return prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } });
}

/**
 * حفظ مستخدم من الاستيراد جوه transaction المحرك: بيعمله لو مش موجود (من غير كلمة سر)،
 * وبيضيف الأدوار الناقصة بس (مش بيشيل أدوار قديمة). المقارنة يدوي لأن NULL في الـ unique مش بيتساوى.
 */
export async function upsertImportedUser(
  tx: Tx,
  g: { email: string; name: string; phone: string | null; roles: RoleScopeInput[] },
  roleKey: (r: RoleScopeInput) => string,
): Promise<{ created: boolean; rolesAdded: number }> {
  const found = await tx.user.findUnique({
    where: { email: g.email },
    select: { id: true, roles: { select: { role: true, scopeType: true, scopeId: true } } },
  });
  if (!found) {
    await tx.user.create({ data: { name: g.name, email: g.email, phone: g.phone, roles: { create: g.roles } }, select: { id: true } });
    return { created: true, rolesAdded: g.roles.length };
  }
  await tx.user.update({ where: { id: found.id }, data: { name: g.name, ...(g.phone ? { phone: g.phone } : {}) }, select: { id: true } });
  const have = new Set(found.roles.map(roleKey));
  const missing = g.roles.filter((r) => !have.has(roleKey(r)));
  if (missing.length) await tx.userRole.createMany({ data: missing.map((r) => ({ ...r, userId: found.id })) });
  return { created: false, rolesAdded: missing.length };
}

// ── التفويضات ───────────────────────────────────────────

const pick = { select: { id: true, name: true, email: true } } as const;

export function listDelegations() {
  return prisma.delegation.findMany({
    orderBy: [{ endsOn: "desc" }, { startsOn: "desc" }],
    take: 300,
    select: { id: true, startsOn: true, endsOn: true, note: true, fromUser: pick, toUser: pick },
  });
}

export function insertDelegation(data: { fromUserId: string; toUserId: string; startsOn: Date; endsOn: Date; note: string | null }, audit: Audit) {
  return prisma.$transaction(async (tx) => {
    const d = await tx.delegation.create({ data, select: { id: true } });
    await tx.auditLog.create({ data: { ...audit, entityId: d.id } });
    return d;
  });
}

export function removeDelegation(id: string, audit: Audit) {
  return prisma.$transaction(async (tx) => {
    const res = await tx.delegation.deleteMany({ where: { id } });
    if (res.count) await tx.auditLog.create({ data: audit });
    return res.count;
  });
}

// ── الصلاحيات ───────────────────────────────────────────

export function listPermissionRows(): Promise<PermissionRow[]> {
  return prisma.rolePermission.findMany({ select: { role: true, permission: true } });
}

/** بيطبّق خطة planPermissionToggle في transaction واحدة */
export function applyPermissionPlan(plan: PermissionPlan, audit: Audit) {
  return prisma.$transaction(async (tx: Tx) => {
    if (plan.seed.length) await tx.rolePermission.createMany({ data: plan.seed, skipDuplicates: true });
    if (plan.add) await tx.rolePermission.createMany({ data: [plan.add], skipDuplicates: true });
    if (plan.remove) {
      await tx.rolePermission.deleteMany({ where: { role: plan.remove.role as Role, permission: plan.remove.permission } });
    }
    await tx.auditLog.create({ data: audit });
  });
}
