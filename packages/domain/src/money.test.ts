import { describe, expect, it } from 'vitest';
import { DomainError } from './errors';
import { pctOf, ratioPct, round2, sumBy, sumMoney, toCents, toNumber, toNumberOrNull } from './money';

describe('round2', () => {
  it('rounds half away from zero, including binary edge cases', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(1.004)).toBe(1);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
  it('never returns -0', () => {
    expect(Object.is(round2(-0.001), 0)).toBe(true);
  });
  it('rejects non-finite values', () => {
    expect(() => round2(Number.NaN)).toThrow(DomainError);
    expect(() => round2(Infinity)).toThrow(DomainError);
  });
});

describe('toNumber', () => {
  it('accepts number, string and Decimal-like objects', () => {
    expect(toNumber(12.5)).toBe(12.5);
    expect(toNumber('9791650.25')).toBe(9791650.25);
    expect(toNumber('1,250.5')).toBe(1250.5);
    expect(toNumber({ toString: () => '0.30' })).toBe(0.3);
  });
  it('rejects garbage and empty strings', () => {
    expect(() => toNumber('abc')).toThrow(DomainError);
    expect(() => toNumber('')).toThrow(DomainError);
    expect(() => toNumber(Number.NaN)).toThrow(DomainError);
  });
  it('toNumberOrNull maps null/empty to null', () => {
    expect(toNumberOrNull(null)).toBeNull();
    expect(toNumberOrNull(undefined)).toBeNull();
    expect(toNumberOrNull('  ')).toBeNull();
    expect(toNumberOrNull('5')).toBe(5);
  });
});

describe('safe sums', () => {
  it('sums in cents without float drift', () => {
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6);
    expect(sumMoney(Array.from({ length: 1000 }, () => 0.01))).toBe(10);
    expect(sumMoney([1, null, undefined, 2.5])).toBe(3.5);
  });
  it('sumBy picks a field', () => {
    expect(sumBy([{ a: 1.1 }, { a: 2.2 }], (x) => x.a)).toBe(3.3);
  });
  it('toCents / pctOf / ratioPct', () => {
    expect(toCents(12.345)).toBe(1235);
    expect(pctOf(1_000_000, 14)).toBe(140_000);
    expect(pctOf(333.33, 1)).toBe(3.33);
    expect(ratioPct(50, 200)).toBe(25);
    expect(ratioPct(5, 0)).toBe(0);
  });
});
