import { round2 } from './money';
import type { StatusColor } from './types';

/*
 * الالتزام المالي لأمر التكليف: المفوتر التراكمي مقابل الالتزام المعتمد.
 * الالتزام ممكن يبقى أقل من قيمة أمر التكليف، وبيتجدد بخطاب "تجديد التزام مالي".
 */

/** يتلوّن أصفر لما المفوتر يوصل النسبة دي من الالتزام. */
export const COMMITMENT_WARN_PCT = 90;

export interface CommitmentInput {
  aoValue: number;
  /** null/0 = مفيش التزام منفصل، والحد = قيمة أمر التكليف */
  financialCommitment: number | null;
  /** إجمالي المفوتر على أمر التكليف (كل المستخلصات غير المسودة) */
  billedCumulative: number;
}

export interface CommitmentState {
  limit: number;
  billed: number;
  /** المفوتر كـ % من الحد */
  pct: number;
  remaining: number;
  exceeded: boolean;
  /** الالتزام المعتمد أقل من قيمة أمر التكليف */
  partial: boolean;
  level: 'ok' | 'warn' | 'exceeded';
  cls: Extract<StatusColor, 'g' | 'a' | 'r'>;
  warning: string | null;
}

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

/** حالة الالتزام المالي + نص التنبيه للمراجعين. */
export function commitmentState(input: CommitmentInput, warnPct: number = COMMITMENT_WARN_PCT): CommitmentState {
  const fc = input.financialCommitment && input.financialCommitment > 0 ? input.financialCommitment : null;
  const limit = round2(fc ?? input.aoValue);
  const billed = round2(input.billedCumulative);
  const pct = limit > 0 ? round2((billed / limit) * 100) : billed > 0 ? 100 : 0;
  const exceeded = billed > limit;
  const base = { limit, billed, pct, remaining: round2(limit - billed), exceeded, partial: fc != null && fc < input.aoValue };
  if (exceeded) {
    const warning = `المفوتر على أمر التكليف (${fmt(billed)}) عدّى الالتزام المالي المعتمد (${fmt(limit)}) — محتاج تجديد التزام مالي قبل الصرف`;
    return { ...base, level: 'exceeded', cls: 'r', warning };
  }
  if (pct >= warnPct) {
    return { ...base, level: 'warn', cls: 'a', warning: `المفوتر وصل ${pct.toFixed(0)}% من الالتزام المالي لأمر التكليف` };
  }
  return { ...base, level: 'ok', cls: 'g', warning: null };
}
