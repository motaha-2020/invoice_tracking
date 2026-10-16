import { DomainError } from './errors';

/*
 * أيام العمل بمنطق "تاريخ بس" (YYYY-MM-DD) — مفيش ساعات ولا timezone.
 * Date object بيتقري بمكوناته الـ UTC (زي ما Prisma بيرجّع عمود @db.Date).
 * لو عندك timestamp (زي `since`) حوّله الأول بـ localDate() بتوقيت القاهرة.
 */

/** تاريخ: 'YYYY-MM-DD' أو Date (بيتقري UTC). */
export type DateInput = string | Date;
/** الإجازات الرسمية كـ ISO dates. */
export type Holidays = ReadonlySet<string> | readonly string[];

const MS_PER_DAY = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** الجمعة والسبت (getUTCDay: 5، 6) */
export const WEEKEND_DAYS: readonly number[] = [5, 6];

/** رقم اليوم من 1970-01-01 (UTC). */
function toDayNumber(input: DateInput): number {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new DomainError('INVALID_DATE', 'تاريخ غير صالح');
    return Math.floor(input.getTime() / MS_PER_DAY);
  }
  const m = ISO_RE.exec(input.slice(0, 10));
  if (!m) throw new DomainError('INVALID_DATE', `تاريخ غير صالح: ${input}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  if (new Date(ms).getUTCDate() !== d) throw new DomainError('INVALID_DATE', `تاريخ غير صالح: ${input}`);
  return ms / MS_PER_DAY;
}

function fromDayNumber(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

function holidaySet(holidays: Holidays): ReadonlySet<string> {
  return holidays instanceof Set ? holidays : new Set(holidays);
}

function isWorkingDayNumber(day: number, holidays: ReadonlySet<string>): boolean {
  const weekday = new Date(day * MS_PER_DAY).getUTCDay();
  return !WEEKEND_DAYS.includes(weekday) && !holidays.has(fromDayNumber(day));
}

/** يحوّل أي DateInput لـ 'YYYY-MM-DD'. */
export function toIsoDate(input: DateInput): string {
  return fromDayNumber(toDayNumber(input));
}

/** تاريخ اليوم المحلي لـ timestamp في timezone معيّن (افتراضي القاهرة). */
export function localDate(timestamp: Date, timeZone = 'Africa/Cairo'): string {
  if (Number.isNaN(timestamp.getTime())) throw new DomainError('INVALID_DATE', 'تاريخ غير صالح');
  // en-CA بيطلع الصيغة YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp);
}

/** هل اليوم ده يوم عمل؟ (مش جمعة ولا سبت ولا إجازة رسمية) */
export function isWorkingDay(date: DateInput, holidays: Holidays = []): boolean {
  return isWorkingDayNumber(toDayNumber(date), holidaySet(holidays));
}

/**
 * عدد أيام العمل بعد `a` لحد `b` (a مش محسوب، b محسوب).
 * نفس اليوم = 0، ولو b قبل a = 0.
 */
export function workingDaysBetween(a: DateInput, b: DateInput, holidays: Holidays = []): number {
  const set = holidaySet(holidays);
  const end = toDayNumber(b);
  let count = 0;
  for (let d = toDayNumber(a) + 1; d <= end; d++) if (isWorkingDayNumber(d, set)) count++;
  return count;
}

/** يزوّد (أو ينقص لو n سالب) n يوم عمل على التاريخ. n = 0 → نفس التاريخ. */
export function addWorkingDays(date: DateInput, n: number, holidays: Holidays = []): string {
  if (!Number.isInteger(n)) throw new DomainError('INVALID_NUMBER', 'يجب أن يكون عدد الأيام عدداً صحيحاً');
  const set = holidaySet(holidays);
  const step = n < 0 ? -1 : 1;
  let day = toDayNumber(date);
  for (let left = Math.abs(n); left > 0; ) {
    day += step;
    if (isWorkingDayNumber(day, set)) left--;
  }
  return fromDayNumber(day);
}
