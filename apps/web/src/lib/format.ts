/**
 * تنسيق الأرقام والتواريخ للعرض.
 * الأرقام دايماً بالأرقام الإنجليزية (زي الديمو والمستندات الرسمية)، والتاريخ بتوقيت القاهرة
 * عشان السيرفر (UTC) والمتصفح يطلعوا نفس النص ومفيش hydration mismatch.
 */

/** أي قيمة رقمية جاية من DB: number أو string أو Prisma.Decimal (اللي ليه toString) */
export type Numeric = number | string | { toString(): string };

const TZ = "Africa/Cairo";
const DASH = "—";

function toNumber(v: Numeric | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

const moneyFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyIntFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** فلوس: 1,234,567.50 (أو من غير قروش لو decimals = 0) */
export function formatMoney(v: Numeric | null | undefined, opts: { decimals?: 0 | 2 } = {}): string {
  const n = toNumber(v);
  if (n == null) return DASH;
  return (opts.decimals === 0 ? moneyIntFmt : moneyFmt).format(n);
}

/** كميات: لحد 4 أرقام عشرية (الـ DB بيخزن 4)، والافتراضي 2 زي الديمو */
export function formatQty(v: Numeric | null | undefined, opts: { maxDecimals?: number } = {}): string {
  const n = toNumber(v);
  if (n == null) return DASH;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: opts.maxDecimals ?? 2 }).format(n);
}

/** عدد صحيح بفواصل الآلاف */
export function formatCount(v: number | null | undefined): string {
  return v == null ? DASH : moneyIntFmt.format(v);
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "numeric", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

/** تاريخ: 15/10/2026 */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return DASH;
  const date = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? DASH : dateFmt.format(date);
}

/** تاريخ ووقت: 15/10/2026 14:05 */
export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return DASH;
  const date = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? DASH : `${dateFmt.format(date)} ${timeFmt.format(date)}`;
}
