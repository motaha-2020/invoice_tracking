import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getSettings } from "@/features/workflow/workflow.repo";
import { open } from "@/lib/secret-box";
import { resolveSmtp, smtpFingerprint, type SmtpConfig } from "./smtp.rules";

/**
 * إعدادات SMTP: من شاشة «خادم البريد الإلكتروني» (كلمة السر مشفّرة في قاعدة البيانات)،
 * أو من متغيرات SMTP_* على السيرفر لو الشاشة فاضية. مفيش خادم = الإرسال متوقف والرسائل بتفضل pending.
 */
const CACHE_MS = 15_000;
let cached: { at: number; cfg: SmtpConfig | null } | null = null;

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.cfg;
  const cfg = resolveSmtp(await getSettings(), process.env, open);
  cached = { at: Date.now(), cfg };
  return cfg;
}

/** بعد الحفظ من الشاشة — عشان المرسل ياخد الإعدادات الجديدة على طول */
export function invalidateSmtpConfig(): void {
  cached = null;
}

let transport: { key: string; t: Transporter } | null = null;

export function transportFor(c: SmtpConfig, opts: { pool?: boolean } = {}): Transporter {
  const base = {
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: c.user ? { user: c.user, pass: c.password } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
  };
  return opts.pool ? nodemailer.createTransport({ ...base, pool: true, maxConnections: 2 }) : nodemailer.createTransport(base);
}

/** transport مشترك للمرسل — بيتعمل من جديد لو الإعدادات اتغيرت */
export async function getMailer(): Promise<{ t: Transporter; from: { name: string; address: string }; cfg: SmtpConfig } | null> {
  const cfg = await getSmtpConfig();
  if (!cfg || cfg.passwordBroken) {
    transport?.t.close();
    transport = null;
    return null;
  }
  const key = smtpFingerprint(cfg);
  if (transport?.key !== key) {
    transport?.t.close();
    transport = { key, t: transportFor(cfg, { pool: true }) };
  }
  return { t: transport.t, from: { name: cfg.fromName, address: cfg.from }, cfg };
}
