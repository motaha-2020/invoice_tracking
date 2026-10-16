import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * إعدادات SMTP من البيئة (.env على السيرفر) — كلمة السر مش في قاعدة البيانات ولا في الكود.
 * SMTP_HOST فاضي = الإرسال متوقف، والرسائل بتفضل في الصندوق (pending) لحد ما يتظبط.
 */
export type SmtpInfo = { configured: boolean; host: string; port: number; secure: boolean; from: string };

export function smtpInfo(): SmtpInfo {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const port = Number(process.env.SMTP_PORT ?? 587) || 587;
  return {
    configured: !!host,
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    from: process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || "",
  };
}

let transport: Transporter | null = null;

export function getTransport(): Transporter | null {
  const s = smtpInfo();
  if (!s.configured) return null;
  transport ??= nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
    pool: true,
    maxConnections: 2,
  });
  return transport;
}

/** اسم المرسل الظاهر */
export const FROM_NAME = "منظومة تتبع المستخلصات";
