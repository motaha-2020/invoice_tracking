import { describe, expect, it } from 'vitest';
import { suggestCategory } from './category';
import { lineView, linesSummary, toCategoryLines, toTotalsLines, type LineInput } from './invoice-lines';

const base: LineInput = {
  contractItemId: 'ci1', itemNo: '1-1-1', description: 'حفر', unit: 'م.ط', workType: 'مدني',
  unitPrice: 100, qty: 10, approvedQty: null, plannedQty: 50, prevQty: 30, inAo: true,
};

describe('lineView', () => {
  it('uses the submitted qty until a reviewer changes it', () => {
    const v = lineView(base);
    expect(v).toMatchObject({ approvedQty: 10, cumQty: 40, overQty: 0, total: 1000, submittedTotal: 1000, changed: false, isNew: false, notInAo: false });
    expect(v.overPct).toBeCloseTo(-20);
  });

  it('flags cumulative over the planned qty and a changed approval', () => {
    const v = lineView({ ...base, approvedQty: 25 });
    expect(v).toMatchObject({ approvedQty: 25, cumQty: 55, overQty: 5, total: 2500, submittedTotal: 1000, changed: true });
    expect(v.overPct).toBeCloseTo(10);
  });

  it('treats an item outside the AO as 100% over', () => {
    const v = lineView({ ...base, plannedQty: 0, prevQty: 0, inAo: false });
    expect(v).toMatchObject({ notInAo: true, overQty: 10, overPct: 100 });
  });

  it('has no totals for an unpriced item', () => {
    const v = lineView({ ...base, unitPrice: null });
    expect(v.total).toBeNull();
    expect(v.submittedTotal).toBeNull();
  });

  it('rounds money to piasters', () => {
    expect(lineView({ ...base, qty: 3, unitPrice: 0.335 }).total).toBe(1.01);
  });
});

describe('toCategoryLines', () => {
  it('merges the same item across sites so overrun is per item', () => {
    const a = lineView({ ...base, qty: 15, siteCode: '#75' });
    const b = lineView({ ...base, qty: 10, siteCode: '#76' });
    const lines = toCategoryLines([a, b]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ approvedQty: 25, prevQty: 30, plannedQty: 50 });
    expect(suggestCategory({ lines, aoValue: 1_000_000 }).category).toBe('C2');
  });

  it('marks new (non-contract) items so the category is C5', () => {
    const v = lineView({ ...base, contractItemId: null, itemNo: 'N-1', unitPrice: null });
    expect(suggestCategory({ lines: toCategoryLines([v]), aoValue: 1000 }).category).toBe('C5');
  });
});

describe('summary', () => {
  it('sums gross and submitted and counts flags', () => {
    const vs = [lineView({ ...base, approvedQty: 25 }), lineView({ ...base, contractItemId: 'ci2', unitPrice: null })];
    expect(linesSummary(vs)).toEqual({ gross: 2500, submitted: 1000, unpriced: 1, over: 1, changed: 1 });
    expect(toTotalsLines(vs)).toEqual([
      { unitPrice: 100, approvedQty: 25, workType: 'مدني' },
      { unitPrice: null, approvedQty: 10, workType: 'مدني' },
    ]);
  });
});
