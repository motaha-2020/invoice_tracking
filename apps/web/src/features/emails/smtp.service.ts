import "server-only";
import type { SessionUser } from "@/features/auth/auth.types";
import { can } from "@/features/auth/permissions";
import { getSettings, saveSettings } from "@/features/workflow/workflow.repo";
import { AppError } from "@/lib/errors";
import { seal } from "@/lib/secret-box";
import { getSmtpConfig, invalidateSmtpConfig, transportFor } from "./mailer";
import type { SmtpInput } from "./smtp.schema";
import { DEFAULT_FROM_NAME } from "./smtp.rules";

/** شاشة «خادم البريد الإلكتروني»: التعديل والاختبار لمدير النظام بس، والعرض لمن يدير الإعدادات */
async function assertEdit(actor: SessionUser) {
  if (!(await can(actor, "users.manage"))) throw new AppError("FORBIDDEN", "تعديل إعدادات البريد متاح لمدير النظام فقط");
}

export type SmtpView = {
  canEdit: boolean;
  /** المصدر الفعلي اللي المرسل شغال بيه دلوقتي */
  active: { source: "db" | "env"; host: string; from: string; passwordBroken: boolean } | null;
  form: { host: string; port: string; security: "starttls" | "ssl"; user: string; hasPassword: boolean; from: string; fromName: string };
};

export async function getSmtpView(actor: SessionUser): Promise<SmtpView> {
  const [raw, cfg, canEdit] = await Promise.all([getSettings(), getSmtpConfig(), can(actor, "users.manage")]);
  const s = (k: string) => (raw[k] == null ? "" : String(raw[k]));
  const port = s("smtpPort") || "587";
  return {
    canEdit,
    active: cfg ? { source: cfg.source, host: cfg.host, from: cfg.from, passwordBroken: cfg.passwordBroken } : null,
    form: {
      host: s("smtpHost"),
      port,
      security: raw.smtpSecure === true || port === "465" ? "ssl" : "starttls",
      user: s("smtpUser"),
      hasPassword: !!s("smtpPassword"),
      from: s("smtpFrom"),
      fromName: s("smtpFromName") || DEFAULT_FROM_NAME,
    },
  };
}

export async function saveSmtp(actor: SessionUser, v: SmtpInput): Promise<void> {
  await assertEdit(actor);
  const pwChange = v.clearPassword ? "cleared" : v.password ? "changed" : "kept";
  const values: Record<string, string | number | boolean> = {
    smtpHost: v.host,
    smtpPort: v.port,
    smtpSecure: v.security === "ssl",
    smtpUser: v.user,
    smtpFrom: v.from,
    smtpFromName: v.fromName || DEFAULT_FROM_NAME,
    ...(pwChange === "cleared" ? { smtpPassword: "" } : pwChange === "changed" ? { smtpPassword: seal(v.password!) } : {}),
  };
  await saveSettings(values, {
    userId: actor.id,
    action: "settings.smtp.update",
    entity: "settings",
    details: { host: v.host, port: v.port, security: v.security, user: v.user, from: v.from, password: pwChange },
  });
  invalidateSmtpConfig();
}

/** رسالة تجريبية لبريد مدير النظام نفسه بالإعدادات الحالية — بترجع رسالة الخطأ بالعربي لو فشلت */
export async function sendTestEmail(actor: SessionUser): Promise<string> {
  await assertEdit(actor);
  invalidateSmtpConfig();
  const cfg = await getSmtpConfig();
  if (!cfg) throw new AppError("VALIDATION", "لم تُضبط بيانات خادم البريد بعد");
  if (cfg.passwordBroken) throw new AppError("VALIDATION", "تعذّر قراءة كلمة المرور المحفوظة — يرجى إعادة إدخالها وحفظ الإعدادات");
  const t = transportFor(cfg);
  try {
    await t.verify();
    await t.sendMail({
      from: { name: cfg.fromName, address: cfg.from },
      to: { name: actor.name, address: actor.email },
      subject: "رسالة تجريبية — منظومة تتبع المستخلصات",
      text: `السيد/ ${actor.name}،\n\nهذه رسالة تجريبية للتأكد من إعدادات خادم البريد الإلكتروني (${cfg.host}:${cfg.port}).\nوصول هذه الرسالة يعني أن إرسال التنبيهات يعمل بشكل صحيح.`,
    });
    return actor.email;
  } catch (e) {
    throw new AppError("VALIDATION", smtpErrorMessage(e));
  } finally {
    t.close();
  }
}

function smtpErrorMessage(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; message?: string };
  const raw = (err.message ?? String(e)).slice(0, 200);
  if (err.code === "EAUTH" || err.responseCode === 535) return `اسم المستخدم أو كلمة المرور غير صحيحة (في Gmail يلزم استخدام App Password). — ${raw}`;
  if (err.code === "ETIMEDOUT" || err.code === "ECONNECTION" || err.code === "ESOCKET" || err.code === "ECONNREFUSED")
    return `تعذّر الاتصال بالخادم — تأكد من اسم الخادم والمنفذ (يُفضَّل 587 مع STARTTLS). — ${raw}`;
  if (err.code === "EDNS" || /ENOTFOUND|EAI_AGAIN/.test(raw)) return `اسم الخادم غير معروف — ${raw}`;
  if (err.code === "EENVELOPE" || err.responseCode === 550 || err.responseCode === 553) return `رفض الخادم عنوان المرسل أو المستلم — تأكد أن عنوان المرسل مسموح له بالإرسال من هذا الحساب. — ${raw}`;
  return `تعذّر الإرسال: ${raw}`;
}
