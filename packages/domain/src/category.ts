import { round2, toCents } from './money';

/** فئة التجاوز — بتحدد المسار. */
export type CategoryCode = 'C1' | 'C2' | 'C3' | 'C4' | 'C5';
export const CATEGORY_CODES: readonly CategoryCode[] = ['C1', 'C2', 'C3', 'C4', 'C5'];

/** حد C3: الإجمالي التراكمي يتجاوز أمر التكليف لحد 25% (شاملة). */
export const C3_MAX_OVER_PCT = 25;

/** بند في المستخلص بالكميات اللازمة لحساب التجاوز. */
export interface CategoryLine {
  itemNo: string;
  /** null = مالوش سعر في العقد */
  unitPrice: number | null;
  /** بند مستجد مش في المقايسة */
  isNew: boolean;
  /** كمية أمر التكليف (0 لو البند مش في أمر التكليف) */
  plannedQty: number;
  /** المعتمد في المستخلصات السابقة على نفس أمر التكليف */
  prevQty: number;
  approvedQty: number;
}

export interface SuggestCategoryInput {
  lines: readonly CategoryLine[];
  /** قيمة أمر التكليف الحالية (بعد الملاحق). null = غير معروفة */
  aoValue: number | null;
  /**
   * قيمة تراكمية لبنود اتفوترت قبل كده على أمر التكليف ومش موجودة في المستخلص ده.
   * من غيرها الإجمالي التراكمي بيبقى أقل من الحقيقي.
   */
  otherItemsCumulativeValue?: number;
}

export interface CategorySuggestion {
  category: CategoryCode;
  reasons: string[];
  /** (التراكمي − أمر التكليف) / أمر التكليف × 100 — سالب يعني لسه فيه رصيد. null لو مش محسوب */
  totalOverPct: number | null;
  cumulativeValue: number | null;
}

const fmtQty = (n: number): string => String(Math.round(n * 100) / 100);

function overLines(lines: readonly CategoryLine[]): string[] {
  return lines
    .filter((l) => l.prevQty + l.approvedQty > l.plannedQty + 1e-9)
    .map((l) => {
      const cum = l.prevQty + l.approvedQty;
      const pct = l.plannedQty ? ((cum - l.plannedQty) / l.plannedQty) * 100 : 100;
      return `البند ${l.itemNo} تراكمي ${fmtQty(cum)} من ${fmtQty(l.plannedQty)} (+${pct.toFixed(1)}%)`;
    });
}

function cumulativeValue(lines: readonly CategoryLine[], other: number): number {
  const cents = lines.reduce((acc, l) => acc + toCents((l.prevQty + l.approvedQty) * (l.unitPrice ?? 0)), 0);
  return cents / 100 + round2(other);
}

/**
 * يقترح فئة التجاوز من البنود:
 * C5 بند مستجد/من غير سعر ← C1 مفيش بند تراكمي فوق المخطط ← C2 فيه تجاوز بند والإجمالي ≤ أمر التكليف
 * ← C3 الإجمالي تجاوز لحد 25% ← C4 أكتر من 25%.
 */
export function suggestCategory(input: SuggestCategoryInput): CategorySuggestion {
  const { lines, aoValue } = input;
  if (lines.some((l) => l.isNew || l.unitPrice == null)) {
    return { category: 'C5', reasons: ['فيه بند مستجد مالوش سعر في العقد'], totalOverPct: null, cumulativeValue: null };
  }
  const cumValue = cumulativeValue(lines, input.otherItemsCumulativeValue ?? 0);
  const overPct = aoValue && aoValue > 0 ? round2(((cumValue - aoValue) / aoValue) * 100) : null;
  const over = overLines(lines);
  const base = { totalOverPct: overPct, cumulativeValue: cumValue };
  if (!over.length) return { ...base, category: 'C1', reasons: ['كل الكميات التراكمية في حدود أمر التكليف'] };
  if (!aoValue || aoValue <= 0) {
    return { ...base, category: 'C4', reasons: [...over, 'قيمة أمر التكليف غير معروفة — اتعامل كتجاوز أكبر من 25%'] };
  }
  // المقارنة بالقروش عشان الحدود (= قيمة أمر التكليف بالظبط، = 25% بالظبط) تبقى دقيقة
  const cumCents = toCents(cumValue);
  const aoCents = toCents(aoValue);
  if (cumCents <= aoCents) return { ...base, category: 'C2', reasons: [...over, 'الإجمالي التراكمي لسه جوه قيمة أمر التكليف'] };
  const reasons = [...over, `الإجمالي التراكمي تجاوز أمر التكليف بـ ${(overPct ?? 0).toFixed(1)}%`];
  const withinC3 = cumCents * 100 <= aoCents * (100 + C3_MAX_OVER_PCT);
  return { ...base, category: withinC3 ? 'C3' : 'C4', reasons };
}
