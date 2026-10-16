import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * تشفير الأسرار اللي بتتخزن في قاعدة البيانات (زي كلمة سر البريد) — AES-256-GCM.
 * المفتاح من SETTINGS_KEY لو موجود، وإلا من DATABASE_URL (اللي فيه كلمة سر قاعدة البيانات):
 * يعني نسخة احتياطية من قاعدة البيانات لوحدها مابتكشفش كلمة السر.
 * لو المفتاح اتغير (تغيير كلمة سر قاعدة البيانات مثلاً) الفك بيرجع null، ومدير النظام يعيد إدخالها.
 */
function key(): Buffer {
  const material = process.env.SETTINGS_KEY || process.env.DATABASE_URL || "";
  if (!material) throw new Error("SETTINGS_KEY / DATABASE_URL غير مضبوط");
  return Buffer.from(hkdfSync("sha256", material, "invoice-tracking", "settings-secret-v1", 32));
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function open(sealed: string): string | null {
  const [v, iv, tag, ct] = sealed.split(":");
  if (v !== "v1" || !iv || !tag || ct == null) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
