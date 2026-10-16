import "server-only";
import type { Role } from "@it/db";
import type { SessionUser } from "@/features/auth/auth.types";
import { createInvite } from "@/features/auth/invite.service";
import type { Permission } from "@/features/auth/permission-rules";
import { can } from "@/features/auth/permissions";
import { hasRole } from "@/features/auth/scope";
import { AppError } from "@/lib/errors";
import * as repo from "./users.repo";
import { ENTITY_SCOPE_TYPES, effectiveMatrix, keepsUsersManage, normalizeRoleScopes, planPermissionToggle, type EntityScopeType } from "./users.rules";
import type { DelegationInput, UserInput } from "./users.schema";
import type { DelegationRow, InviteLink, ScopeOptions, UserFilter, UserRow } from "./users.types";

async function assertManage(actor: SessionUser) {
  if (!(await can(actor, "users.manage"))) throw new AppError("FORBIDDEN");
}

/** اسم الجهة لكل "type:id" من قوايم الاختيار */
function scopeNamer(options: ScopeOptions) {
  const names = new Map<string, string>();
  for (const t of ENTITY_SCOPE_TYPES) for (const e of options[t]) names.set(`${t}:${e.id}`, e.name);
  return (t: string, id: string | null) => (t === "all" ? "جميع الجهات" : (names.get(`${t}:${id}`) ?? "جهة محذوفة"));
}

export async function getUsersPage(actor: SessionUser, filter: UserFilter): Promise<{ users: UserRow[]; options: ScopeOptions }> {
  await assertManage(actor);
  const [rows, options] = await Promise.all([repo.listUsers(filter), repo.listScopeOptions()]);
  const nameOf = scopeNamer(options);
  const users = rows.map((u) => ({
    ...u,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    roles: u.roles.map((r) => ({ ...r, scopeName: nameOf(r.scopeType, r.scopeId) })),
  }));
  return { users, options };
}

function knownIds(options: ScopeOptions) {
  const out = {} as Record<EntityScopeType, Set<string>>;
  for (const t of ENTITY_SCOPE_TYPES) out[t] = new Set(options[t].map((e) => e.id));
  return out;
}

/** إضافة / تعديل مستخدم بأدواره. ممنوع الأدمن يقفل على نفسه (يوقف نفسه أو يشيل دور الإدارة من نفسه). */
export async function saveUser(actor: SessionUser, input: UserInput): Promise<{ id: string; created: boolean }> {
  await assertManage(actor);
  const options = await repo.listScopeOptions();
  const roles = normalizeRoleScopes(input.roles, knownIds(options));
  if (roles.value === undefined) throw new AppError("VALIDATION", roles.error);

  const sameEmail = await repo.findUserIdByEmail(input.email);
  if (sameEmail && sameEmail.id !== input.id) throw new AppError("CONFLICT", "البريد الإلكتروني مسجل لمستخدم آخر");

  const data = { name: input.name, email: input.email, phone: input.phone, active: input.active };
  const details = { email: input.email, roles: roles.value.map((r) => `${r.role}:${r.scopeType}`) };

  if (!input.id) {
    const u = await repo.createUserWithRoles(data, roles.value, { userId: actor.id, action: "user.create", entity: "user", details });
    return { id: u.id, created: true };
  }

  const existing = await repo.findUserById(input.id);
  if (!existing) throw new AppError("NOT_FOUND", "المستخدم غير موجود");
  if (input.id === actor.id) {
    if (!input.active) throw new AppError("VALIDATION", "لا يمكن إيقاف الحساب المستخدم حالياً في تسجيل الدخول");
    const rows = await repo.listPermissionRows();
    if (!keepsUsersManage(roles.value.map((r) => r.role), rows)) {
      throw new AppError("VALIDATION", "لا يمكن إزالة الدور الذي يمنحك صلاحية إدارة المستخدمين من حسابك — سيؤدي ذلك إلى فقدان الصلاحية");
    }
  }
  await repo.updateUserWithRoles(input.id, data, roles.value, { userId: actor.id, action: "user.update", entity: "user", entityId: input.id, details });
  return { id: input.id, created: false };
}

/** إيقاف / تفعيل. الإيقاف بيمسح كل جلساته فبيخرج فوراً. */
export async function setActive(actor: SessionUser, userId: string, active: boolean): Promise<void> {
  await assertManage(actor);
  if (userId === actor.id && !active) throw new AppError("VALIDATION", "لا يمكن إيقاف الحساب المستخدم حالياً في تسجيل الدخول");
  const u = await repo.findUserById(userId);
  if (!u) throw new AppError("NOT_FOUND", "المستخدم غير موجود");
  await repo.setUserActive(userId, active, {
    userId: actor.id,
    action: active ? "user.activate" : "user.deactivate",
    entity: "user",
    entityId: userId,
  });
}

/** دعوة لمستخدم واحد — الإيميل بيتكتب في الصادر والرابط بيرجع للأدمن يعرضه مرة واحدة */
export async function inviteUser(actor: SessionUser, userId: string): Promise<{ link: string }> {
  return createInvite(actor, userId, "invite");
}

/** دعوات لكل الجداد اللي لسه ما اتبعتلهمش (بعد الاستيراد) */
export async function inviteNewUsers(actor: SessionUser): Promise<InviteLink[]> {
  await assertManage(actor);
  const users = await repo.listNeverInvitedUsers();
  const out: InviteLink[] = [];
  for (const u of users) {
    const { link } = await createInvite(actor, u.id, "invite");
    out.push({ userId: u.id, name: u.name, email: u.email, link });
  }
  return out;
}

export async function countNeverInvited(actor: SessionUser): Promise<number> {
  await assertManage(actor);
  return (await repo.listNeverInvitedUsers()).length;
}

// ── التفويضات ───────────────────────────────────────────

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function getDelegations(actor: SessionUser): Promise<{ rows: DelegationRow[]; users: { id: string; name: string; email: string }[] }> {
  await assertManage(actor);
  const [rows, users] = await Promise.all([repo.listDelegations(), repo.listUserPicks()]);
  return { rows: rows.map((d) => ({ ...d, startsOn: iso(d.startsOn), endsOn: iso(d.endsOn) })), users };
}

export async function addDelegation(actor: SessionUser, input: DelegationInput): Promise<void> {
  await assertManage(actor);
  const [from, to] = await Promise.all([repo.findUserById(input.fromUserId), repo.findUserById(input.toUserId)]);
  if (!from || !to) throw new AppError("NOT_FOUND", "المستخدم غير موجود");
  if (!to.active) throw new AppError("VALIDATION", "حساب البديل موقوف");
  await repo.insertDelegation(
    {
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      startsOn: new Date(`${input.startsOn}T00:00:00Z`),
      endsOn: new Date(`${input.endsOn}T00:00:00Z`),
      note: input.note,
    },
    { userId: actor.id, action: "delegation.create", entity: "delegation", details: { from: from.email, to: to.email, startsOn: input.startsOn, endsOn: input.endsOn } },
  );
}

export async function deleteDelegation(actor: SessionUser, id: string): Promise<void> {
  await assertManage(actor);
  const n = await repo.removeDelegation(id, { userId: actor.id, action: "delegation.delete", entity: "delegation", entityId: id });
  if (!n) throw new AppError("NOT_FOUND", "التفويض غير موجود");
}

// ── الصلاحيات ───────────────────────────────────────────

export async function getPermissionMatrix(actor: SessionUser): Promise<{ matrix: Record<Permission, Role[]>; editable: boolean }> {
  await assertManage(actor);
  return { matrix: effectiveMatrix(await repo.listPermissionRows()), editable: hasRole(actor, "admin") };
}

/** تعديل خانة في المصفوفة — لمدير النظام بس */
export async function togglePermission(actor: SessionUser, perm: Permission, role: Role, on: boolean): Promise<void> {
  await assertManage(actor);
  if (!hasRole(actor, "admin")) throw new AppError("FORBIDDEN", "تعديل الصلاحيات مقصور على مدير النظام");
  const plan = planPermissionToggle(await repo.listPermissionRows(), perm, role, on);
  if (plan.value === undefined) throw new AppError("VALIDATION", plan.error);
  await repo.applyPermissionPlan(plan.value, {
    userId: actor.id,
    action: on ? "permission.grant" : "permission.revoke",
    entity: "role_permission",
    entityId: `${role}:${perm}`,
  });
}

export async function getRoleCounts(actor: SessionUser): Promise<Partial<Record<Role, number>>> {
  await assertManage(actor);
  const rows = await repo.countUsersByRole();
  return Object.fromEntries(rows.map((r) => [r.role, r._count._all]));
}
