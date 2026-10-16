/**
 * مصدر إعدادات البريد (دوال صافية — بتتختبر بـ vitest):
 * 1) الإعدادات المحفوظة من شاشة «خادم البريد الإلكتروني» (settings) لو فيها خادم.
 * 2) وإلا متغيرات البيئة SMTP_* على السيرفر (الطريقة القديمة — لسه شغالة).
 * 3) وإلا الإرسال متوقف والرسائل بتفضل «قيد الإرسال».
 */
export type SmtpConfig = {
  source: "db" | "env";
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  fromName: string;
  /** كلمة السر المحفوظة مش قادرين نفكها (المفتاح اتغير) — لازم تتدخل تاني */
  passwordBroken: boolean;
};

export const DEFAULT_FROM_NAME = "منظومة تتبع المستخلصات";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const port = (v: unknown, fallback = 587) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
};

export function resolveSmtp(
  db: Record<string, unknown>,
  env: Record<string, string | undefined>,
  openSecret: (sealed: string) => string | null,
): SmtpConfig | null {
  const fromName = str(db.smtpFromName) || DEFAULT_FROM_NAME;
  const host = str(db.smtpHost);
  if (host) {
    const sealed = str(db.smtpPassword);
    const pw = sealed ? openSecret(sealed) : "";
    const user = str(db.smtpUser);
    const p = port(db.smtpPort);
    return {
      source: "db",
      host,
      port: p,
      secure: db.smtpSecure === true || p === 465,
      user,
      password: pw ?? "",
      from: str(db.smtpFrom) || user,
      fromName,
      passwordBroken: pw == null,
    };
  }
  const envHost = str(env.SMTP_HOST);
  if (!envHost) return null;
  const p = port(env.SMTP_PORT);
  return {
    source: "env",
    host: envHost,
    port: p,
    secure: env.SMTP_SECURE === "true" || p === 465,
    user: str(env.SMTP_USER),
    password: env.SMTP_PASSWORD ?? "",
    from: str(env.SMTP_FROM) || str(env.SMTP_USER),
    fromName,
    passwordBroken: false,
  };
}

/** بصمة الإعدادات — لو اتغيرت بنعمل transport جديد */
export const smtpFingerprint = (c: SmtpConfig) => JSON.stringify([c.host, c.port, c.secure, c.user, c.password]);

/**
 * عناوين الاختبار المحجوزة (RFC 2606/6761): ‎.test و ‎.example و ‎.invalid و example.com/org/net.
 * مرسل البريد ما بيبعتلهاش — بتتسجل في سجل البريد فاشلة بسبب واضح (عشان المحاكاة ما تبعتش بريد حقيقي).
 */
export function isReservedTestAddress(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return /\.(test|example|invalid|localhost)$/.test(domain) || /^example\.(com|org|net)$/.test(domain);
}

export const TEST_ADDRESS_NOTE = "عنوان اختبار — لا يُرسل إليه بريد";
