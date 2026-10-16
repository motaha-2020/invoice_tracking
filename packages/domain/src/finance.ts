import type { CommitmentState } from './commitment';
import { round2 } from './money';

/*
 * قواعد المالية (المرحلة 4):
 * - الاستقطاعات اللي المالية بتعتمدها قبل السداد (ضريبي بنسبة، استقطاعات أخرى، غرامات يدوية بسبب).
 * - قفل السداد لو المفوتر تجاوز الارتباط المالي المعتمد (قرار التشغيل: قفل تام).
 * - صرف المبالغ المحتجزة على نفس المستخلص بعد استيفاء مستندها.
 */

export type EditableDeductionType = 'tax' | 'penalty' | 'other';

export interface DeductionRow {
  type: EditableDeductionType;
  name: string;
  /** نسبة من إجمالي الأعمال المعتمدة، أو مبلغ ثابت */
  mode: 'pct' | 'amount';
  value: number;
  note?: string | null;
}

/** يرجّع أول خطأ بالعربي، أو null لو الصفوف سليمة */
export function validateDeductions(rows: readonly DeductionRow[]): string | null {
  for (const r of rows) {
    const label = r.name.trim() || 'الاستقطاع';
    if (!r.name.trim()) return 'يرجى إدخال اسم لكل استقطاع';
    if (!Number.isFinite(r.value) || r.value < 0) return `قيمة «${label}» غير صحيحة`;
    if (r.mode === 'pct' && r.value > 100) return `نسبة «${label}» أكبر من 100%`;
    if (r.type === 'penalty' && r.mode !== 'amount') return 'تُدخل الغرامة كمبلغ وليس كنسبة';
    if (r.type === 'penalty' && !r.note?.trim()) return `يرجى توضيح سبب الغرامة «${label}»`;
  }
  return null;
}

/** مبلغ الاستقطاع من إجمالي الأعمال المعتمدة */
export function deductionAmount(r: Pick<DeductionRow, 'mode' | 'value'>, gross: number): number {
  return r.mode === 'pct' ? round2((gross * r.value) / 100) : round2(r.value);
}

/** هل السداد مسموح؟ القفل تام عند تجاوز الارتباط المالي حتى يُعتمد تعزيزه */
export function payBlock(commitment: Pick<CommitmentState, 'exceeded' | 'billed' | 'limit'> | null): string | null {
  if (!commitment?.exceeded) return null;
  const over = round2(commitment.billed - commitment.limit);
  return `لا يمكن تسجيل السداد: القيمة المفوترة على أمر التكليف تتجاوز الارتباط المالي المعتمد بمبلغ ${over.toLocaleString('en-US')} جنيه — يلزم اعتماد تعزيز الارتباط المالي أولاً`;
}

export type HeldType = 'asbuilt' | 'handover';

/**
 * المستندات اللي بتسمح بصرف كل نوع محتجز (أكواد doc_types — أي واحد منهم كفاية).
 * As-Built: مستند مرحلة المالية بس (خرائط ما بعد التنفيذ) — رسومات As-Built المرفقة مع التقديم ما تكفيش.
 */
export const RELEASE_DOCS: Readonly<Record<HeldType, readonly string[]>> = {
  asbuilt: ['asbuilt_maps'],
  handover: ['prelim_handover_report', 'prelim_handover_cert'],
};

export const HELD_LABELS: Readonly<Record<HeldType, string>> = {
  asbuilt: 'خرائط ما بعد التنفيذ (As-Built)',
  handover: 'الاستلام الابتدائي',
};

/** هل مستند الصرف موجود في مرفقات المستخلص؟ */
export function releaseDocPresent(type: HeldType, attachedDocCodes: Iterable<string>): boolean {
  const have = new Set(attachedDocCodes);
  return RELEASE_DOCS[type].some((c) => have.has(c));
}
