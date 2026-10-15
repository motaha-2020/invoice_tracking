// تشفير التوكنات وكلمات السر للـ seed — لازم يطابق الـ web بالظبط:
//  - التوكن (دعوة / session): randomBytes(32) base64url، والـ id في DB = sha256(token) hex
//    (زي apps/web/src/features/auth/session.ts → hashToken).
//  - كلمة السر: argon2id بنفس إعدادات apps/web/src/features/auth/password.ts.
// TODO(lead): @node-rs/argon2 جاي من dependencies بتاعة @it/web (hoisted) — ضيفه لـ @it/db مع أول npm install.
import { createHash, randomBytes } from 'node:crypto';
import { hash } from '@node-rs/argon2';

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}
