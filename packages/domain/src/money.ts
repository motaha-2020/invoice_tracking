import { DomainError } from './errors';

/** أي قيمة رقمية جاية من DB: number أو string أو Prisma Decimal (أي object عنده toString). */
export type DecimalLike = number | string | { toString(): string };

/** تقريب لقرشين (half away from zero) من غير أخطاء floating زي 1.005. */
export function round2(n: number): number {
  if (!Number.isFinite(n)) throw new DomainError('INVALID_NUMBER', 'قيمة رقمية غير صالحة');
  const sign = n < 0 ? -1 : 1;
  // toPrecision(15) بيشيل ذيل الـ binary (1.005 → 1.00499999… → 1.005) قبل التقريب
  const abs = Number((Math.abs(n) * 100).toPrecision(15));
  return (sign * Math.round(abs)) / 100 || 0;
}

/** يحوّل number | string | Decimal لـ number. بيرمي DomainError لو القيمة مش رقم. */
export function toNumber(v: DecimalLike): number {
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(/,/g, ''));
  if (!Number.isFinite(n) || (typeof v !== 'number' && String(v).trim() === '')) {
    throw new DomainError('INVALID_NUMBER', `قيمة رقمية غير صالحة: ${String(v)}`);
  }
  return n;
}

/** زي toNumber بس null/undefined/'' بترجع null. */
export function toNumberOrNull(v: DecimalLike | null | undefined): number | null {
  if (v == null || (typeof v === 'string' && v.trim() === '')) return null;
  return toNumber(v);
}

/** تحويل لقروش (integer) — أساس الجمع الآمن. */
export function toCents(n: number): number {
  return Math.round(round2(n) * 100);
}

/** جمع مبالغ بالقروش، والنتيجة مقربة لقرشين. null/undefined بتتحسب صفر. */
export function sumMoney(values: Iterable<number | null | undefined>): number {
  let cents = 0;
  for (const v of values) if (v != null) cents += toCents(v);
  return cents / 100;
}

/** جمع خاصية من array بالقروش. */
export function sumBy<T>(items: readonly T[], pick: (item: T) => number | null | undefined): number {
  return sumMoney(items.map(pick));
}

/** نسبة مئوية من مبلغ، مقربة لقرشين: pctOf(1000, 14) = 140 */
export function pctOf(amount: number, pct: number): number {
  return round2((amount * pct) / 100);
}

/** a كام % من b (من غير تقريب). b = 0 → 0. */
export function ratioPct(a: number, b: number): number {
  return b ? (a / b) * 100 : 0;
}
