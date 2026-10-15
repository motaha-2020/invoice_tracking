import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Role } from "@it/db";
import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { deleteSession, extendSession, findSessionWithUser, insertSession } from "./auth.repo";
import type { SessionUser } from "./auth.types";
import { can, type Permission } from "./permissions";
import { hasRole } from "./scope";
import { SESSION_COOKIE, SESSION_TTL_MS, sessionCookieOptions } from "./session-cookie";

/**
 * الجلسات:
 * - التوكن 32 byte عشوائي في كوكي httpOnly (it_session)، والـ DB بيخزن sha256(token) بس كـ Session.id
 *   (تسريب الـ DB ما يدّيش جلسات شغالة).
 * - الصلاحية 12 ساعة sliding: الـ proxy بيجدد الكوكي مع كل تنقل، و getCurrentUser بيمد expiresAt في DB.
 */

/** ما نكتبش في DB مع كل request — بنمد الصلاحية لو فات أكتر من 10 دقايق من آخر مد */
const EXTEND_THRESHOLD_MS = 10 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** بيعمل جلسة جديدة ويحط الكوكي — من Server Action بس (الكوكيز ما تتكتبش وقت الـ render) */
export async function createSession(userId: string, meta: { ip?: string | null; userAgent?: string | null } = {}) {
  const token = randomBytes(32).toString("base64url");
  await insertSession({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    ip: meta.ip ?? null,
    userAgent: meta.userAgent?.slice(0, 400) ?? null,
  });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
}

/** بيمسح الجلسة الحالية من DB ومن المتصفح — من Server Action بس */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(hashToken(token));
  store.delete(SESSION_COOKIE);
}

/**
 * المستخدم الحالي (أو null). متخزن لكل request بـ React cache، فأي عدد من المكونات يناديه بـ query واحدة.
 * بيقرا cookies() — فلازم يتنادى جوه <Suspense> (Cache Components).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const id = hashToken(token);
  const session = await findSessionWithUser(id);
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now || !session.user.active) {
    await deleteSession(id);
    return null;
  }
  if (session.expiresAt.getTime() - now < SESSION_TTL_MS - EXTEND_THRESHOLD_MS) {
    await extendSession(id, new Date(now + SESSION_TTL_MS));
  }

  const { user } = session;
  return { id: user.id, name: user.name, email: user.email, roles: user.roles };
});

/** لازم يكون فيه مستخدم — غير كده تحويل لصفحة الدخول */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** لازم المستخدم يكون ليه دور من دول — غير كده 403 */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasRole(user, ...roles)) forbidden();
  return user;
}

/** لازم المستخدم يكون ليه الصلاحية — غير كده 403 */
export async function requirePermission(perm: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await can(user, perm))) forbidden();
  return user;
}
