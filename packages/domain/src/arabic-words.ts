import { DomainError } from './errors';

/*
 * التفقيط (رقم ← حروف) بقواعد العدد والمعدود:
 *   1 → ألف، 2 → ألفان، 3..10 → ثلاثة آلاف، 11..99 → أحد عشر ألفاً، 100 → مائة ألف.
 *   المعدود بيتبع آخر رقمين: 103 ألف = مائة وثلاثة آلاف، 120 ألف = مائة وعشرون ألفاً،
 *   و101 ألف = مائة ألف وألف (مش "مائة وواحد ألف").
 */

const ONES = [
  '', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
  'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر',
];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

interface Scale {
  value: number;
  one: string; // ألف (مفرد مجرور/مرفوع)
  two: string; // ألفان
  plural: string; // آلاف (3..10)
  accusative: string; // ألفاً (11..99)
}

const SCALES: readonly Scale[] = [
  { value: 1e9, one: 'مليار', two: 'ملياران', plural: 'مليارات', accusative: 'ملياراً' },
  { value: 1e6, one: 'مليون', two: 'مليونان', plural: 'ملايين', accusative: 'مليوناً' },
  { value: 1e3, one: 'ألف', two: 'ألفان', plural: 'آلاف', accusative: 'ألفاً' },
];

const join = (parts: string[]): string => parts.filter(Boolean).join(' و');

function belowHundred(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  const one = n % 10;
  const ten = TENS[Math.floor(n / 10)] ?? '';
  return one ? `${ONES[one]} و${ten}` : ten;
}

function belowThousand(n: number): string {
  return join([HUNDREDS[Math.floor(n / 100)] ?? '', belowHundred(n % 100)]);
}

/** عدد (1..999) من وحدة معيّنة (ألف/مليون/مليار) بصيغة المعدود الصحيحة. */
function scaleGroup(count: number, s: Scale): string {
  const hundreds = count - (count % 100);
  const rest = count % 100;
  const head = hundreds ? belowThousand(hundreds) : '';
  if (rest === 0) return `${head} ${s.one}`;
  if (rest <= 2) {
    const tail = rest === 1 ? s.one : s.two;
    return head ? `${head} ${s.one} و${tail}` : tail;
  }
  const noun = rest <= 10 ? s.plural : s.accusative;
  return `${join([head, belowHundred(rest)])} ${noun}`;
}

/** رقم صحيح موجب ← كلمات عربية. الكسور بتتشال (floor). 0 → "صفر". */
export function numberToArabicWords(n: number): string {
  if (!Number.isFinite(n)) throw new DomainError('INVALID_NUMBER', 'قيمة رقمية غير صالحة');
  let rest = Math.floor(Math.abs(n));
  if (rest >= 1e12) throw new DomainError('INVALID_NUMBER', 'الرقم أكبر من الحد المسموح للتفقيط');
  if (rest === 0) return 'صفر';
  const parts: string[] = [];
  for (const s of SCALES) {
    const count = Math.floor(rest / s.value);
    rest %= s.value;
    if (count) parts.push(scaleGroup(count, s));
  }
  if (rest) parts.push(belowThousand(rest));
  return (n < 0 ? 'سالب ' : '') + join(parts);
}

/**
 * التفقيط بالجنيه المصري مع القروش:
 * 2450000.5 → "مليونان وأربعمائة وخمسون ألفاً جنيهاً مصرياً وخمسون قرشاً لا غير"
 */
export function amountInWordsEGP(amount: number): string {
  if (!Number.isFinite(amount)) throw new DomainError('INVALID_NUMBER', 'قيمة رقمية غير صالحة');
  const cents = Math.round(Math.abs(amount) * 100);
  const pounds = Math.floor(cents / 100);
  const piastres = cents % 100;
  const sign = amount < 0 && cents > 0 ? 'سالب ' : '';
  const parts: string[] = [];
  if (pounds > 0 || piastres === 0) parts.push(`${numberToArabicWords(pounds)} جنيهاً مصرياً`);
  if (piastres > 0) parts.push(`${numberToArabicWords(piastres)} قرشاً`);
  return `${sign}${join(parts)} لا غير`;
}
