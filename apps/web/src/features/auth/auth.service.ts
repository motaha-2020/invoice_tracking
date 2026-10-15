import "server-only";
import { AppError } from "@/lib/errors";
import { ROLE_LABELS, SCOPE_TYPE_LABELS } from "@/lib/labels";
import { findUserForLogin, markLogin, scopeEntityNames, writeAudit } from "./auth.repo";
import type { SessionUser } from "./auth.types";
import { verifyAgainstDummy, verifyPassword } from "./password";
import { loginLimits } from "./rate-limit";

/**
 * التحقق من الدخول. رسالة الخطأ واحدة لكل الحالات (مستخدم مش موجود، موقوف، كلمة سر غلط)
 * عشان ما نكشفش مين عنده حساب.
 */
export async function authenticate(email: string, password: string, meta: { ip: string }): Promise<{ userId: string }> {
  const emailKey = `email:${email}`;
  const ipKey = `ip:${meta.ip}`;
  if (loginLimits.email.isBlocked(emailKey) || loginLimits.ip.isBlocked(ipKey)) {
    throw new AppError("RATE_LIMITED");
  }

  const user = await findUserForLogin(email);
  const ok = user?.passwordHash ? await verifyPassword(user.passwordHash, password) : (await verifyAgainstDummy(password), false);

  if (!user || !ok || !user.active) {
    loginLimits.email.hit(emailKey);
    loginLimits.ip.hit(ipKey);
    if (user) await writeAudit({ userId: user.id, action: "login.failed", entity: "user", entityId: user.id, details: { ip: meta.ip } });
    throw new AppError("INVALID_CREDENTIALS");
  }

  loginLimits.email.reset(emailKey);
  await markLogin(user.id);
  await writeAudit({ userId: user.id, action: "login", entity: "user", entityId: user.id, details: { ip: meta.ip } });
  return { userId: user.id };
}

/** وصف أدوار المستخدم ونطاقاته للعرض: [{ role: 'مدير تنفيذ', scope: 'إدارة المنصورة' }] */
export async function describeRoles(user: SessionUser): Promise<{ role: string; scope: string }[]> {
  const names = await scopeEntityNames(user.roles);
  return user.roles.map((r) => ({
    role: ROLE_LABELS[r.role],
    scope:
      r.scopeType === "all"
        ? SCOPE_TYPE_LABELS.all
        : (names.get(`${r.scopeType}:${r.scopeId}`) ?? `${SCOPE_TYPE_LABELS[r.scopeType]} غير معروف`),
  }));
}
