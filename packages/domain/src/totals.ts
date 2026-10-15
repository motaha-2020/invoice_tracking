import { amountInWordsEGP } from './arabic-words';
import { DomainError } from './errors';
import { pctOf, round2, sumBy } from './money';
import type { DeductionType, InvoiceKind } from './types';

/*
 * الحسابات المالية للمستخلص.
 *
 *   gross      = Σ (الكمية المعتمدة × سعر الوحدة)          — البنود من غير سعر = 0 (وبتتعد في unpricedLines)
 *   held       = gross × payAsbuiltPct% (As-Built) + gross × payHandoverPct% (التسليم الابتدائي)
 *                (مستخلص التخطيط: مفيش محجوز، وبيتصرف planningPayPct% — عادةً 100%)
 *   payableNow = gross − held                                — يعني gross × payMonthlyPct%
 *   vat        = vatBase × vatPct%                           — vatBase حسب TOTALS_POLICY (الافتراضي gross)
 *   deductions = الخصم من المنبع (withholdingBase × taxPct%) + أي استقطاعات أخرى + الغرامات
 *   net        = payableNow + vat − Σ deductions
 *
 * مثال (عقد 232): gross 1,000,000 بشروط 70/20/10 وضريبة 14% وخصم منبع 1%
 *   held = 200,000 + 100,000، payableNow = 700,000، vat = 140,000، خصم = 10,000، net = 830,000
 *
 * الدمغات بتتدفع مرة واحدة على أمر التكليف، فمش جزء من المستخلص.
 */

/** سياسة الضريبة — المالية ممكن تغيّرها هنا (أو تبعت policy مختلفة لـ invoiceTotals). */
export interface TotalsPolicy {
  /**
   * 'gross': القيمة المضافة على كامل قيمة الأعمال المعتمدة وبتتصرف مع المستخلص
   *          (المستخلصات المصرية بتكتب القيمة "شامل الضريبة" على قيمة المستخلص كلها).
   * 'payableNow': على الجزء المصروف دلوقتي بس، والباقي يتحسب لما المحجوز يتصرف.
   */
  vatBase: 'gross' | 'payableNow';
  /** أساس الخصم من المنبع والاستقطاعات اللي بنسبة. */
  withholdingBase: 'gross' | 'payableNow';
}

export const TOTALS_POLICY: Readonly<TotalsPolicy> = { vatBase: 'gross', withholdingBase: 'gross' };

/** شروط الدفع من العقد (النسب كـ % مش كسور). */
export interface PaymentTerms {
  vatPct: number;
  payMonthlyPct: number;
  payAsbuiltPct: number;
  payHandoverPct: number;
  planningPayPct: number;
  /** الخصم من المنبع — null/0 = مفيش */
  taxPct?: number | null;
}

export interface TotalsLine {
  unitPrice: number | null;
  approvedQty: number;
  workType?: string | null;
}

export interface DeductionInput {
  type: DeductionType;
  name: string;
  /** لو موجودة بتتحسب من الأساس، وإلا amount */
  pct?: number | null;
  amount?: number | null;
}

export interface Deduction {
  type: DeductionType;
  name: string;
  pct: number | null;
  amount: number;
}

export interface Penalty {
  name?: string;
  amount: number;
}

export interface HeldAmount {
  type: 'asbuilt' | 'handover';
  name: string;
  pct: number;
  amount: number;
}

export interface InvoiceTotalsInput {
  lines: readonly TotalsLine[];
  kind: InvoiceKind;
  terms: PaymentTerms;
  /** بيستبدل الاستقطاعات الافتراضية (الخصم من المنبع) — المالية بتعدّلها */
  deductionsOverride?: readonly DeductionInput[];
  penalties?: readonly Penalty[];
  policy?: TotalsPolicy;
}

export interface InvoiceTotals {
  gross: number;
  byWorkType: Record<string, number>;
  unpricedLines: number;
  payNowPct: number;
  payableNow: number;
  held: HeldAmount[];
  heldTotal: number;
  vatPct: number;
  vat: number;
  deductions: Deduction[];
  deductionsTotal: number;
  net: number;
  words: string;
}

export const UNKNOWN_WORK_TYPE = 'غير محدد';
const PCT_TOLERANCE = 0.001;

function grossOf(lines: readonly TotalsLine[]): { gross: number; byWorkType: Record<string, number> } {
  const byWorkType: Record<string, number> = {};
  for (const l of lines) {
    if (l.unitPrice == null) continue;
    const key = l.workType || UNKNOWN_WORK_TYPE;
    byWorkType[key] = round2((byWorkType[key] ?? 0) + round2(l.approvedQty * l.unitPrice));
  }
  return { gross: sumBy(Object.values(byWorkType), (v) => v), byWorkType };
}

function heldOf(gross: number, kind: InvoiceKind, t: PaymentTerms): HeldAmount[] {
  if (kind === 'planning') return [];
  const sum = t.payMonthlyPct + t.payAsbuiltPct + t.payHandoverPct;
  if (Math.abs(sum - 100) > PCT_TOLERANCE) {
    throw new DomainError('TERMS_PCT_SUM', `نسب الصرف في العقد مجموعها ${sum}% بدل 100%`);
  }
  const held: HeldAmount[] = [];
  if (t.payAsbuiltPct > 0) held.push({ type: 'asbuilt', name: 'محجوز لحد تسليم خرائط As-Built', pct: t.payAsbuiltPct, amount: pctOf(gross, t.payAsbuiltPct) });
  if (t.payHandoverPct > 0) held.push({ type: 'handover', name: 'محجوز لحد التسليم الابتدائي', pct: t.payHandoverPct, amount: pctOf(gross, t.payHandoverPct) });
  return held;
}

function deductionsOf(input: InvoiceTotalsInput, base: number): Deduction[] {
  const taxPct = input.terms.taxPct ?? 0;
  const defaults: DeductionInput[] = taxPct > 0 ? [{ type: 'tax', name: 'خصم ضريبي من المنبع', pct: taxPct }] : [];
  const list = (input.deductionsOverride ?? defaults).map((d) => ({
    type: d.type,
    name: d.name,
    pct: d.pct ?? null,
    amount: d.pct != null ? pctOf(base, d.pct) : round2(d.amount ?? 0),
  }));
  const penalties = (input.penalties ?? []).map((p) => ({
    type: 'penalty' as const, name: p.name || 'غرامة تأخير', pct: null, amount: round2(p.amount),
  }));
  return [...list, ...penalties];
}

/** إجمالي وضريبة ومحجوز واستقطاعات وصافي المستخلص (المعادلة في أول الملف). */
export function invoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const policy = input.policy ?? TOTALS_POLICY;
  const { terms, kind } = input;
  const { gross, byWorkType } = grossOf(input.lines);
  const held = heldOf(gross, kind, terms);
  const heldTotal = sumBy(held, (h) => h.amount);
  const payNowPct = kind === 'planning' ? terms.planningPayPct : terms.payMonthlyPct;
  const payableNow = kind === 'planning' ? pctOf(gross, terms.planningPayPct) : round2(gross - heldTotal);
  const vat = pctOf(policy.vatBase === 'gross' ? gross : payableNow, terms.vatPct);
  const deductions = deductionsOf(input, policy.withholdingBase === 'gross' ? gross : payableNow);
  const deductionsTotal = sumBy(deductions, (d) => d.amount);
  const net = round2(payableNow + vat - deductionsTotal);
  return {
    gross, byWorkType, unpricedLines: input.lines.filter((l) => l.unitPrice == null).length,
    payNowPct, payableNow, held, heldTotal, vatPct: terms.vatPct, vat,
    deductions, deductionsTotal, net, words: amountInWordsEGP(net),
  };
}
