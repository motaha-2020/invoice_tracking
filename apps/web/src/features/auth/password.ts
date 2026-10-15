import "server-only";
import { hash, verify } from "@node-rs/argon2";

// argon2id (الافتراضي في @node-rs/argon2) بإعدادات OWASP: 19 MiB، 2 iterations
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    // hash بايظ في DB = مش مطابق (ومش crash)
    return false;
  }
}

// hash ثابت لمستخدم مش موجود: بنعمل verify عليه عشان وقت الرد يبقى قريب من المستخدم الموجود
let dummyHash: Promise<string> | null = null;
export async function verifyAgainstDummy(plain: string): Promise<void> {
  dummyHash ??= hashPassword("dummy-password-for-timing");
  await verifyPassword(await dummyHash, plain);
}
