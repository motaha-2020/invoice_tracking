import { describe, expect, it } from 'vitest';
import { suggestCategory, type CategoryLine } from './category';

const line = (over: Partial<CategoryLine> = {}): CategoryLine => ({
  itemNo: '1-1', unitPrice: 100, isNew: false, plannedQty: 100, prevQty: 0, approvedQty: 50, ...over,
});

describe('suggestCategory', () => {
  it('C5 when any line is new or has no price', () => {
    expect(suggestCategory({ lines: [line(), line({ isNew: true })], aoValue: 10_000 }).category).toBe('C5');
    expect(suggestCategory({ lines: [line({ unitPrice: null })], aoValue: 10_000 }).category).toBe('C5');
  });

  it('C1 when no line is cumulatively over its planned qty (exactly planned is not over)', () => {
    const r = suggestCategory({ lines: [line({ prevQty: 50, approvedQty: 50 })], aoValue: 10_000 });
    expect(r.category).toBe('C1');
    expect(r.totalOverPct).toBe(0);
  });

  it('C2 when a line is over but cumulative value equals the AO value exactly', () => {
    // البند 1: 120 من 100 (12,000)، البند 2: 0 من 100 — الإجمالي 12,000 = قيمة أمر التكليف
    const r = suggestCategory({
      lines: [line({ approvedQty: 120 }), line({ itemNo: '1-2', approvedQty: 0 })],
      aoValue: 12_000,
    });
    expect(r.category).toBe('C2');
    expect(r.reasons[0]).toContain('البند 1-1: الكمية التراكمية 120 من 100 (+20.0%)');
  });

  it('C3 one piastre above the AO value', () => {
    const r = suggestCategory({ lines: [line({ approvedQty: 120, unitPrice: 100 })], aoValue: 11_999.99 });
    expect(r.category).toBe('C3');
  });

  it('C3 at exactly 25% over, C4 just above', () => {
    expect(suggestCategory({ lines: [line({ approvedQty: 125 })], aoValue: 10_000 }).category).toBe('C3');
    const c4 = suggestCategory({ lines: [line({ approvedQty: 125.01 })], aoValue: 10_000 });
    expect(c4.category).toBe('C4');
    expect(c4.totalOverPct).toBe(25.01);
  });

  it('counts previous quantities in the cumulative', () => {
    const r = suggestCategory({ lines: [line({ prevQty: 80, approvedQty: 30 })], aoValue: 20_000 });
    expect(r.category).toBe('C2');
  });

  it('includes value of previously billed items not in this invoice', () => {
    const lines = [line({ approvedQty: 110 })]; // 11,000
    expect(suggestCategory({ lines, aoValue: 12_000 }).category).toBe('C2');
    expect(suggestCategory({ lines, aoValue: 12_000, otherItemsCumulativeValue: 2_000 }).category).toBe('C3');
  });

  it('a line not in the AO (planned 0) counts as over', () => {
    const r = suggestCategory({ lines: [line({ plannedQty: 0, approvedQty: 1 })], aoValue: 10_000 });
    expect(r.category).toBe('C2');
    expect(r.reasons[0]).toContain('+100.0%');
  });

  it('treats unknown AO value as C4 when there is an over line', () => {
    const r = suggestCategory({ lines: [line({ approvedQty: 101 })], aoValue: null });
    expect(r.category).toBe('C4');
    expect(r.totalOverPct).toBeNull();
  });
});
