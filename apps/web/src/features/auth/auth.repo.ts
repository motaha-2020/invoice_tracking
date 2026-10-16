import "server-only";
import { prisma, type Prisma } from "@it/db";
import type { PermissionRow } from "./permission-rules";
import type { RoleScope } from "./auth.types";

/** الوصول للداتا الخاص بالدخول والجلسات والدعوات — الطبقة الوحيدة هنا اللي بتكلم Prisma */

const roleSelect = { select: { role: true, scopeType: true, scopeId: true } } as const;

// ── الجلسات ─────────────────────────────────────────────

/** الجلسة + المستخدم + أدوار اللي مفوّضينه النهارده (today = yyyy-mm-dd بتوقيت القاهرة) */
export function findSessionWithUser(id: string, today: string) {
  const day = new Date(`${today}T00:00:00Z`);
  return prisma.session.findUnique({
    where: { id },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          roles: roleSelect,
          delegationsTo: {
            where: { startsOn: { lte: day }, endsOn: { gte: day }, fromUser: { active: true } },
            select: { fromUser: { select: { id: true, name: true, roles: roleSelect } } },
          },
        },
      },
    },
  });
}

export function insertSession(data: { id: string; userId: string; expiresAt: Date; ip?: string | null; userAgent?: string | null }) {
  return prisma.session.create({ data, select: { id: true } });
}

export function extendSession(id: string, expiresAt: Date) {
  return prisma.session.updateMany({ where: { id }, data: { expiresAt } });
}

export function deleteSession(id: string) {
  return prisma.session.deleteMany({ where: { id } });
}

// ── الدخول ──────────────────────────────────────────────

export function findUserForLogin(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, active: true, passwordHash: true },
  });
}

export function markLogin(userId: string) {
  return prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() }, select: { id: true } });
}

export function writeAudit(entry: { userId?: string | null; action: string; entity: string; entityId?: string | null; details?: Prisma.InputJsonValue }) {
  return prisma.auditLog.create({ data: entry, select: { id: true } });
}

// ── الصلاحيات ───────────────────────────────────────────

export function listRolePermissions(): Promise<PermissionRow[]> {
  return prisma.rolePermission.findMany({ select: { role: true, permission: true } });
}

// ── الدعوات ─────────────────────────────────────────────

export function findUserForInvite(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, active: true } });
}

export function findInvite(id: string) {
  return prisma.inviteToken.findUnique({
    where: { id },
    select: {
      id: true,
      purpose: true,
      expiresAt: true,
      usedAt: true,
      user: { select: { id: true, name: true, email: true, active: true } },
    },
  });
}

/** توكن الدعوة + الإيميل في صندوق الصادر، في transaction واحدة */
export function insertInviteWithEmail(input: {
  inviteId: string;
  userId: string;
  purpose: string;
  expiresAt: Date;
  email: { toEmail: string; toName: string; subject: string; body: string };
}) {
  return prisma.$transaction([
    // دعوة جديدة بتلغي أي دعوة قديمة لسه ما اتستخدمتش لنفس الغرض
    prisma.inviteToken.updateMany({
      where: { userId: input.userId, purpose: input.purpose, usedAt: null },
      data: { expiresAt: new Date() },
    }),
    prisma.inviteToken.create({
      data: { id: input.inviteId, userId: input.userId, purpose: input.purpose, expiresAt: input.expiresAt },
      select: { id: true },
    }),
    prisma.emailOutbox.create({ data: { ...input.email, status: "pending" }, select: { id: true } }),
  ]);
}

/**
 * استخدام الدعوة: بتتعلم كمستخدمة (مرة واحدة بس — الشرط usedAt = null بيمنع السباق)،
 * وكلمة السر بتتحدث، وكل الجلسات القديمة بتتمسح. بترجع false لو الدعوة اتستخدمت/انتهت.
 */
export async function consumeInvite(input: { inviteId: string; userId: string; passwordHash: string }): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const res = await tx.inviteToken.updateMany({
      where: { id: input.inviteId, userId: input.userId, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (res.count !== 1) return false;
    await tx.user.update({ where: { id: input.userId }, data: { passwordHash: input.passwordHash }, select: { id: true } });
    await tx.session.deleteMany({ where: { userId: input.userId } });
    await tx.auditLog.create({ data: { userId: input.userId, action: "password.set", entity: "user", entityId: input.userId } });
    return true;
  });
}

// ── أسماء النطاقات (للعرض) ──────────────────────────────

/** اسم الكيان لكل نطاق — بيرجع map بالـ "type:id" */
export async function scopeEntityNames(scopes: RoleScope[]): Promise<Map<string, string>> {
  const ids = (t: RoleScope["scopeType"]) => [...new Set(scopes.filter((s) => s.scopeType === t && s.scopeId).map((s) => s.scopeId!))];
  const q = <T extends { id: string; name: string }>(p: Promise<T[]>, t: string) => p.then((rows) => rows.map((r) => [`${t}:${r.id}`, r.name] as const));
  const sel = { id: true, name: true } as const;
  const lists = await Promise.all([
    ids("company").length ? q(prisma.company.findMany({ where: { id: { in: ids("company") } }, select: sel }), "company") : [],
    ids("presidency").length ? q(prisma.presidency.findMany({ where: { id: { in: ids("presidency") } }, select: sel }), "presidency") : [],
    ids("sector").length ? q(prisma.sector.findMany({ where: { id: { in: ids("sector") } }, select: sel }), "sector") : [],
    ids("general_dept").length ? q(prisma.generalDept.findMany({ where: { id: { in: ids("general_dept") } }, select: sel }), "general_dept") : [],
    ids("dept").length ? q(prisma.dept.findMany({ where: { id: { in: ids("dept") } }, select: sel }), "dept") : [],
    ids("central").length ? q(prisma.central.findMany({ where: { id: { in: ids("central") } }, select: sel }), "central") : [],
  ]);
  return new Map(lists.flat());
}
