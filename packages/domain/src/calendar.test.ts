import { describe, expect, it } from 'vitest';
import { addWorkingDays, isWorkingDay, localDate, toIsoDate, workingDaysBetween } from './calendar';
import { DomainError } from './errors';

// أكتوبر 2026: الخميس 15، الجمعة 16، السبت 17، الأحد 18
const THU = '2026-10-15';
const SUN = '2026-10-18';

describe('isWorkingDay', () => {
  it('treats Friday and Saturday as weekend', () => {
    expect(isWorkingDay(THU)).toBe(true);
    expect(isWorkingDay('2026-10-16')).toBe(false);
    expect(isWorkingDay('2026-10-17')).toBe(false);
    expect(isWorkingDay(SUN)).toBe(true);
  });
  it('treats holidays as non-working (array or Set)', () => {
    expect(isWorkingDay('2026-10-06', ['2026-10-06'])).toBe(false);
    expect(isWorkingDay('2026-10-06', new Set(['2026-10-06']))).toBe(false);
  });
  it('reads Date objects by their UTC date (Prisma @db.Date)', () => {
    expect(isWorkingDay(new Date('2026-10-16T00:00:00Z'))).toBe(false);
    expect(isWorkingDay(new Date('2026-10-15T23:59:59Z'))).toBe(true);
  });
});

describe('workingDaysBetween', () => {
  it('counts days after a up to and including b', () => {
    expect(workingDaysBetween(THU, THU)).toBe(0);
    expect(workingDaysBetween('2026-10-14', THU)).toBe(1);
    expect(workingDaysBetween(THU, SUN)).toBe(1); // Fri + Sat skipped
    expect(workingDaysBetween(THU, '2026-10-22')).toBe(5); // Sun..Thu
  });
  it('returns 0 when b is before a', () => {
    expect(workingDaysBetween(SUN, THU)).toBe(0);
  });
  it('skips holidays', () => {
    expect(workingDaysBetween(THU, '2026-10-22', ['2026-10-19', '2026-10-20'])).toBe(3);
    // إجازة يوم جمعة مش بتتخصم مرتين
    expect(workingDaysBetween(THU, SUN, ['2026-10-16'])).toBe(1);
  });
  it('works across month and year boundaries', () => {
    expect(workingDaysBetween('2026-12-31', '2027-01-04')).toBe(2); // Sun 3 + Mon 4
  });
});

describe('addWorkingDays', () => {
  it('adds working days skipping weekend and holidays', () => {
    expect(addWorkingDays(THU, 1)).toBe(SUN);
    expect(addWorkingDays(THU, 1, ['2026-10-18'])).toBe('2026-10-19');
    expect(addWorkingDays(THU, 0)).toBe(THU);
  });
  it('goes backwards for negative n', () => {
    expect(addWorkingDays(SUN, -1)).toBe(THU);
  });
  it('is the inverse of workingDaysBetween', () => {
    const hol = ['2026-10-20'];
    const end = addWorkingDays('2026-10-01', 10, hol);
    expect(workingDaysBetween('2026-10-01', end, hol)).toBe(10);
  });
  it('rejects fractional n', () => {
    expect(() => addWorkingDays(THU, 1.5)).toThrow(DomainError);
  });
});

describe('date parsing', () => {
  it('normalises to YYYY-MM-DD and rejects invalid dates', () => {
    expect(toIsoDate('2026-10-15T10:00:00Z')).toBe(THU);
    expect(toIsoDate(new Date(Date.UTC(2026, 9, 15)))).toBe(THU);
    expect(() => toIsoDate('2026-02-30')).toThrow(DomainError);
    expect(() => toIsoDate('15/10/2026')).toThrow(DomainError);
    expect(() => toIsoDate(new Date('nope'))).toThrow(DomainError);
  });
  it('localDate converts a timestamp to the Cairo calendar day', () => {
    // 23:30 UTC يوم 14 يناير = 01:30 الفجر يوم 15 بتوقيت القاهرة (UTC+2)
    expect(localDate(new Date('2026-01-14T23:30:00Z'))).toBe('2026-01-15');
    expect(localDate(new Date('2026-01-14T21:00:00Z'))).toBe('2026-01-14');
    expect(localDate(new Date('2026-01-14T23:30:00Z'), 'UTC')).toBe('2026-01-14');
  });
});
