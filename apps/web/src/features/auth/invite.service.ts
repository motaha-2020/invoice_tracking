import "server-only";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { consumeInvite, findInvite, findUserForInvite, insertInviteWithEmail, writeAudit } from "./auth.repo";
import type { SessionUser } from "./auth.types";
import { hashPassword } from "./password";
import { can } from "./permissions";
import { hashToken } from "./session";

/**
 * الدعوات: الأدمن بيعمل دعوة ← توكن عشوائي (الـ DB فيه sha256 بس) صالح 72 ساعة ←
 * الإيميل بيتكتب في email_outbox (pending) والـ worker هيبعته لما يتربط.
 */
export const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

export type InvitePurpose = "invite" | "reset";

/** بيعمل دعوة لمستخدم موجود ويحط إيميلها في الصادر. بيرجع الرابط (للعرض للأدمن لو الإيميل لسه مش شغال). */
export async function createInvite(actor: SessionUser, userId: string, purpose: InvitePurpose = "invite"): Promise<{ link: string }> {
  if (!(await can(actor, "users.manage"))) throw new AppError("FORBIDDEN");

  const user = await findUserForInvite(userId);
  if (!user) throw new AppError("NOT_FOUND", "المستخدم غير موجود");
  if (!user.active) throw new AppError("VALIDATION", "حساب المستخدم موقوف — يرجى تفعيله أولاً");

  const token = randomBytes(32).toString("base64url");
  const link = `${env.appUrl}/invite/${token}`;
  const subject = purpose === "invite" ? "دعوة لمنظومة تتبع المستخلصات" : "إعادة تعيين كلمة المرور — منظومة تتبع المستخلصات";
  const body = [
    `السيد/ ${user.name}`,
    "تحية طيبة وبعد،",
    "",
    purpose === "invite"
      ? "تم إنشاء حساب لسيادتكم على منظومة تتبع المستخلصات. يرجى فتح الرابط التالي لتعيين كلمة المرور:"
      : "ورد طلب لإعادة تعيين كلمة المرور الخاصة بحسابكم. يرجى فتح الرابط التالي لتعيين كلمة مرور جديدة:",
    link,
    "",
    "الرابط صالح لمدة 72 ساعة ولمرة واحدة فقط. في حال عدم تقديمكم لهذا الطلب يرجى تجاهل هذه الرسالة.",
    "",
    "منظومة تتبع المستخلصات — المصرية للاتصالات",
  ].join("\n");

  await insertInviteWithEmail({
    inviteId: hashToken(token),
    userId: user.id,
    purpose,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    email: { toEmail: user.email, toName: user.name, subject, body },
  });
  await writeAudit({ userId: actor.id, action: `invite.${purpose}`, entity: "user", entityId: user.id });
  return { link };
}

/** بيتأكد إن التوكن صالح (موجود، ما اتستخدمش، ما انتهاش) — للصفحة قبل ما تعرض الفورم */
export async function getValidInvite(token: string): Promise<{ userName: string; email: string; purpose: string } | null> {
  if (!token || token.length > 200) return null;
  const inv = await findInvite(hashToken(token));
  if (!inv || inv.usedAt || inv.expiresAt.getTime() <= Date.now() || !inv.user.active) return null;
  return { userName: inv.user.name, email: inv.user.email, purpose: inv.purpose };
}

/** بيحط كلمة السر ويستهلك الدعوة. بيرجع userId عشان الـ action يعمل جلسة. */
export async function acceptInvite(token: string, password: string): Promise<{ userId: string }> {
  const inv = await findInvite(hashToken(token));
  if (!inv || inv.usedAt || inv.expiresAt.getTime() <= Date.now() || !inv.user.active) {
    throw new AppError("INVITE_INVALID");
  }
  const ok = await consumeInvite({ inviteId: inv.id, userId: inv.user.id, passwordHash: await hashPassword(password) });
  if (!ok) throw new AppError("INVITE_INVALID");
  return { userId: inv.user.id };
}
