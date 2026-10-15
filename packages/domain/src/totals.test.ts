import { describe, expect, it } from 'vitest';
import { DomainError } from './errors';
import { invoiceTotals, TOTALS_POLICY, UNKNOWN_WORK_TYPE, type PaymentTerms, type TotalsLine } from './totals';

const T232: PaymentTerms = { vatPct: 14, payMonthlyPct: 70, payAsbuiltPct: 20, payHandoverPct: 10, planningPayPct: 100, taxPct: 1 };
const T231: PaymentTerms = { ...T232, payMonthlyPct: 90, payAsbuiltPct: 0, payHandoverPct: 10 };
const MILLION: TotalsLine[] = [
  { unitPrice: 1000, approvedQty: 600, workType: 'مدني' },
  { unitPrice: 500, approvedQty: 800, workType: 'كهرباء' },
];

describe('invoiceTotals', () => {
  it('default VAT policy is on the full gross', () => {
    expect(TOTALS_POLICY).toEqual({ vatBase: 'gross', withholdingBase: 'gross' });
  });

  it('contract 232 (70/20/10, VAT 14%, withholding 1%) on gross 1,000,000', () => {
    const t = invoiceTotals({ lines: MILLION, kind: 'civil', terms: T232 });
    expect(t.gross).toBe(1_000_000);
    expect(t.byWorkType).toEqual({ مدني: 600_000, كهرباء: 400_000 });
    expect(t.held).toEqual([
      { type: 'asbuilt', name: 'محجوز لحد تسليم خرائط As-Built', pct: 20, amount: 200_000 },
      { type: 'handover', name: 'محجوز لحد التسليم الابتدائي', pct: 10, amount: 100_000 },
    ]);
    expect(t.payNowPct).toBe(70);
    expect(t.payableNow).toBe(700_000);
    expect(t.vat).toBe(140_000);
    expect(t.deductions).toEqual([{ type: 'tax', name: 'خصم ضريبي من المنبع', pct: 1, amount: 10_000 }]);
    expect(t.net).toBe(830_000);
    expect(t.words).toBe('ثمانمائة وثلاثون ألفاً جنيهاً مصرياً لا غير');
  });

  it('contract 231 (90/0/10) has a single holdback', () => {
    const t = invoiceTotals({ lines: MILLION, kind: 'combined', terms: T231 });
    expect(t.held.map((h) => h.type)).toEqual(['handover']);
    expect(t.payableNow).toBe(900_000);
    expect(t.net).toBe(900_000 + 140_000 - 10_000);
  });

  it('planning invoices: no holdbacks, paid at planningPayPct', () => {
    const t = invoiceTotals({ lines: MILLION, kind: 'planning', terms: T232 });
    expect(t.held).toEqual([]);
    expect(t.payNowPct).toBe(100);
    expect(t.payableNow).toBe(1_000_000);
    expect(t.net).toBe(1_000_000 + 140_000 - 10_000);
  });

  it('VAT on payableNow when finance switches the policy', () => {
    const t = invoiceTotals({ lines: MILLION, kind: 'civil', terms: T232, policy: { vatBase: 'payableNow', withholdingBase: 'payableNow' } });
    expect(t.vat).toBe(98_000);
    expect(t.deductions[0]?.amount).toBe(7_000);
    expect(t.net).toBe(700_000 + 98_000 - 7_000);
  });

  it('penalties and deduction overrides', () => {
    const t = invoiceTotals({
      lines: MILLION, kind: 'civil', terms: T232,
      deductionsOverride: [{ type: 'tax', name: 'خصم منبع', pct: 3 }, { type: 'other', name: 'تسوية', amount: 1234.567 }],
      penalties: [{ amount: 5000 }],
    });
    expect(t.deductions.map((d) => d.amount)).toEqual([30_000, 1234.57, 5000]);
    expect(t.deductions[2]).toMatchObject({ type: 'penalty', name: 'غرامة تأخير' });
    expect(t.deductionsTotal).toBe(36_234.57);
    expect(t.net).toBe(round(700_000 + 140_000 - 36_234.57));
  });

  it('no withholding when taxPct is missing or zero', () => {
    expect(invoiceTotals({ lines: MILLION, kind: 'civil', terms: { ...T232, taxPct: null } }).deductions).toEqual([]);
    expect(invoiceTotals({ lines: MILLION, kind: 'civil', terms: { ...T232, taxPct: 0 } }).deductions).toEqual([]);
  });

  it('unpriced lines count as zero and are reported; missing work type is grouped', () => {
    const t = invoiceTotals({ lines: [{ unitPrice: null, approvedQty: 5 }, { unitPrice: 10.005, approvedQty: 3 }], kind: 'civil', terms: T232 });
    expect(t.unpricedLines).toBe(1);
    expect(t.gross).toBe(30.02);
    expect(t.byWorkType).toEqual({ [UNKNOWN_WORK_TYPE]: 30.02 });
  });

  it('parts reconcile to the cent: payableNow + held = gross', () => {
    const t = invoiceTotals({ lines: [{ unitPrice: 333.33, approvedQty: 7 }], kind: 'civil', terms: T232 });
    expect(round(t.payableNow + t.heldTotal)).toBe(t.gross);
  });

  it('rejects contract terms that do not sum to 100%', () => {
    expect(() => invoiceTotals({ lines: MILLION, kind: 'civil', terms: { ...T232, payMonthlyPct: 75 } })).toThrow(DomainError);
  });
});

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
