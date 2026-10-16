import { describe, expect, it } from 'vitest';
import { deductionAmount, payBlock, releaseDocPresent, validateDeductions, type DeductionRow } from './finance';

const tax: DeductionRow = { type: 'tax', name: 'خصم ضريبي من المنبع', mode: 'pct', value: 1 };

describe('validateDeductions', () => {
  it('accepts valid rows', () => {
    expect(validateDeductions([tax, { type: 'penalty', name: 'غرامة تأخير', mode: 'amount', value: 5000, note: 'تأخير 12 يوم' }])).toBeNull();
  });
  it('requires a reason and an amount for penalties', () => {
    expect(validateDeductions([{ type: 'penalty', name: 'غرامة', mode: 'amount', value: 100 }])).toContain('سبب');
    expect(validateDeductions([{ type: 'penalty', name: 'غرامة', mode: 'pct', value: 1, note: 'x' }])).toContain('كمبلغ');
  });
  it('rejects negative values, >100% and empty names', () => {
    expect(validateDeductions([{ ...tax, value: -1 }])).not.toBeNull();
    expect(validateDeductions([{ ...tax, value: 101 }])).toContain('100%');
    expect(validateDeductions([{ ...tax, name: ' ' }])).not.toBeNull();
  });
});

describe('deductionAmount', () => {
  it('computes percent of gross or a fixed amount', () => {
    expect(deductionAmount({ mode: 'pct', value: 1 }, 1_000_000)).toBe(10_000);
    expect(deductionAmount({ mode: 'amount', value: 2500.555 }, 0)).toBe(2500.56);
  });
});

describe('payBlock', () => {
  it('blocks only when the commitment is exceeded', () => {
    expect(payBlock(null)).toBeNull();
    expect(payBlock({ exceeded: false, billed: 900, limit: 1000 })).toBeNull();
    expect(payBlock({ exceeded: true, billed: 850_000, limit: 800_000 })).toContain('50,000');
  });
});

describe('releaseDocPresent', () => {
  it('accepts any of the matching document codes', () => {
    expect(releaseDocPresent('asbuilt', ['asbuilt_maps'])).toBe(true);
    expect(releaseDocPresent('asbuilt', ['asbuilt_drawings'])).toBe(false);
    expect(releaseDocPresent('handover', ['asbuilt_maps'])).toBe(false);
    expect(releaseDocPresent('handover', new Set(['prelim_handover_report']))).toBe(true);
  });
});
