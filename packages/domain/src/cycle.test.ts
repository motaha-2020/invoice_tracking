import { describe, expect, it } from 'vitest';
import { cycleDays, daysByStep, stepSegments, type CycleLogEntry } from './cycle';

// 2026-10-04 أحد. الجمعة والسبت إجازة.
const log: CycleLogEntry[] = [
  { action: 'submit', fromStep: 'company', toStep: 'sup', at: '2026-10-04' },
  { action: 'approve', fromStep: 'sup', toStep: 'exec', at: '2026-10-06' },
  { action: 'category', fromStep: 'exec', toStep: 'exec', at: '2026-10-06' },
  { action: 'return', fromStep: 'exec', toStep: 'company', at: '2026-10-07' },
  { action: 'resubmit', fromStep: 'company', toStep: 'exec', at: '2026-10-12' },
  { action: 'hold', fromStep: 'exec', toStep: 'exec', at: '2026-10-13' },
  { action: 'release', fromStep: 'exec', toStep: 'exec', at: '2026-10-15' },
];

describe('stepSegments', () => {
  it('charges days to the step holding the invoice, the contractor after a return, and stops on hold', () => {
    const segs = stepSegments(log, '2026-10-19');
    expect(segs).toEqual([
      { step: 'sup', days: 2, open: false },
      { step: 'exec', days: 1, open: false },
      { step: 'company', days: 3, open: false },
      { step: 'exec', days: 1, open: false },
      { step: 'exec', days: 2, open: true },
    ]);
    expect(daysByStep(segs)).toEqual({ sup: 2, exec: 4, company: 3 });
  });

  it('respects holidays', () => {
    const segs = stepSegments(log.slice(0, 2), '2026-10-06', ['2026-10-05']);
    expect(segs[0]!.days).toBe(1);
  });
});

describe('cycleDays', () => {
  it('counts from first submission and splits contractor days', () => {
    expect(cycleDays(log, '2026-10-19')).toEqual({ total: 11, company: 3 });
  });
  it('is null before submission', () => {
    expect(cycleDays([], '2026-10-19')).toEqual({ total: null, company: 0 });
  });
});
