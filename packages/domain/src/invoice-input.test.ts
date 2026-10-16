import { describe, expect, it } from 'vitest';
import { checkLineRows, checkMaterialRows, normItemCode, parseQty, type LineCheckContext } from './invoice-input';

const ctx: LineCheckContext = {
  items: new Map([
    ['1', { id: 'g1', isGroup: true, unitPrice: null }],
    ['1-1', { id: 'a', isGroup: false, unitPrice: 10 }],
    ['1-2', { id: 'b', isGroup: false, unitPrice: null }],
    ['2-1', { id: 'c', isGroup: false, unitPrice: 5 }],
  ]),
  aoItemIds: new Set(['a', 'b']),
  sites: new Set(['#75', '#76']),
};

describe('normalizers', () => {
  it('normalizes item codes like the BOQ importer', () => {
    expect(normItemCode(' 1.1.2 ')).toBe('1-1-2');
    expect(normItemCode('١-١')).toBe('1-1');
    expect(normItemCode('n-3')).toBe('N-3');
  });
  it('parses quantities with separators and Arabic digits', () => {
    expect(parseQty('1,250.5')).toBe(1250.5);
    expect(parseQty('١٢')).toBe(12);
    expect(parseQty('')).toBeNaN();
    expect(parseQty(7)).toBe(7);
  });
});

describe('checkLineRows', () => {
  it('accepts valid rows and applies the default site', () => {
    const r = checkLineRows([{ code: '1.1', qty: '4' }], { ...ctx, defaultSite: '#75' });
    expect(r).toMatchObject({ err: 0, warn: 0, lines: [{ contractItemId: 'a', qty: 4, siteCode: '#75' }] });
    expect(r.rows[0]!.level).toBe('ok');
  });

  it('rejects unknown codes, group rows and bad quantities', () => {
    const r = checkLineRows([{ code: '9-9', qty: 1 }, { code: '1', qty: 1 }, { code: '1-1', qty: 0 }, { code: '1-1', qty: 'x' }], ctx);
    expect(r.err).toBe(4);
    expect(r.lines).toHaveLength(0);
    expect(r.rows.every((x) => x.level === 'err')).toBe(true);
  });

  it('warns on unpriced, not-in-AO and unknown site', () => {
    const r = checkLineRows([{ code: '1-2', qty: 1 }, { code: '2-1', qty: 1 }, { code: '1-1', qty: 1, site: '#99' }], ctx);
    expect(r.err).toBe(0);
    expect(r.warn).toBe(3);
    expect(r.lines).toHaveLength(3);
  });

  it('merges duplicate item+site rows and keeps different sites apart', () => {
    const r = checkLineRows([
      { code: '1-1', qty: 2, site: '#75' }, { code: '1-1', qty: 3, site: '#75' }, { code: '1-1', qty: 1, site: '#76' },
    ], ctx);
    expect(r.lines).toEqual([
      { contractItemId: 'a', qty: 5, siteCode: '#75' },
      { contractItemId: 'a', qty: 1, siteCode: '#76' },
    ]);
    expect(r.rows[1]!.merged).toBe(true);
  });

  it('skips empty manual rows instead of failing them', () => {
    const r = checkLineRows([{ code: '1-1', qty: '', manual: true }, { code: '1-2', qty: 2, manual: true }], ctx);
    expect(r.rows[0]!.level).toBe('skip');
    expect(r.err).toBe(0);
    expect(r.lines).toHaveLength(1);
  });
});

describe('checkMaterialRows', () => {
  const catalog = new Map([['1.1.10', 'm1'], ['3.1.26', 'm2']]);
  it('validates codes and merges duplicates', () => {
    const r = checkMaterialRows([{ code: '1.1.10', qty: 5 }, { code: ' 1.1.10', qty: '2.5' }, { code: 'X', qty: 1 }, { code: '3.1.26', qty: 0 }], catalog);
    expect(r.mats).toEqual([{ materialId: 'm1', code: '1.1.10', executedQty: 7.5 }]);
    expect(r.err).toBe(2);
    expect(r.warn).toBe(1);
  });
});
