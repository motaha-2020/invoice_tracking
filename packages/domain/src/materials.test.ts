import { describe, expect, it } from 'vitest';
import { compareMaterial, compareMaterials, type MaterialInput } from './materials';

const m = (over: Partial<MaterialInput> = {}): MaterialInput => ({
  code: 'FO-24', planned: 1000, issued: 500, prevExecuted: 200, executed: 280, ...over,
});
const codes = (x: MaterialInput) => compareMaterial(x).flags.map((f) => f.code);

describe('compareMaterial', () => {
  it('computes cumulative, balance and billed', () => {
    const r = compareMaterial(m({ billed: 270 }));
    expect(r).toMatchObject({ cumExecuted: 480, balance: 20, billed: 270, flags: [] });
    expect(compareMaterial(m()).billed).toBe(280);
  });

  it('flags cumulative executed above issued (red)', () => {
    const r = compareMaterial(m({ executed: 301 }));
    expect(r.balance).toBe(-1);
    expect(r.flags).toEqual([{ code: 'exceeds_issued', cls: 'r', text: 'المنفذ التراكمي أكبر من المنصرف' }]);
  });

  it('flags large unused issued balance (amber) using max(5, 15%)', () => {
    expect(codes(m({ executed: 225 }))).toEqual([]); // رصيد 75 = 15% بالظبط
    expect(codes(m({ executed: 224 }))).toEqual(['unused_issued']);
    expect(codes(m({ issued: 10, prevExecuted: 0, executed: 5 }))).toEqual([]); // 5 مش أكبر من 5
    expect(codes(m({ issued: 10, prevExecuted: 0, executed: 4 }))).toEqual(['unused_issued']);
  });

  it('flags material not in the AO and executed above planned', () => {
    expect(codes(m({ planned: 0 }))).toEqual(['not_in_ao']);
    expect(codes(m({ planned: 400, issued: 480 }))).toEqual(['exceeds_planned']);
    expect(codes(m({ planned: 400, issued: 450 }))).toEqual(['exceeds_issued', 'exceeds_planned']);
  });

  it('avoids float noise on fractional quantities', () => {
    const r = compareMaterial(m({ issued: 0.3, prevExecuted: 0.1, executed: 0.2 }));
    expect(r.cumExecuted).toBe(0.3);
    expect(r.flags).toEqual([]);
  });

  it('custom thresholds and list helper', () => {
    expect(compareMaterial(m({ executed: 290 }), { minUnused: 0, unusedRatio: 0 }).flags[0]?.code).toBe('unused_issued');
    expect(compareMaterials([m(), m({ code: 'X' })]).map((r) => r.code)).toEqual(['FO-24', 'X']);
  });
});
