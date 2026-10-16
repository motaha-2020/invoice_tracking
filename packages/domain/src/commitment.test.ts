import { describe, expect, it } from 'vitest';
import { commitmentState } from './commitment';

describe('commitmentState', () => {
  it('uses the AO value when there is no separate commitment', () => {
    const s = commitmentState({ aoValue: 1_000_000, financialCommitment: null, billedCumulative: 500_000 });
    expect(s).toMatchObject({ limit: 1_000_000, pct: 50, remaining: 500_000, exceeded: false, partial: false, level: 'ok', cls: 'g', warning: null });
  });

  it('a commitment below the AO value is partial and becomes the limit', () => {
    const s = commitmentState({ aoValue: 1_000_000, financialCommitment: 600_000, billedCumulative: 550_000 });
    expect(s).toMatchObject({ limit: 600_000, partial: true, level: 'warn', cls: 'a' });
    expect(s.warning).toBe('بلغت القيمة المفوترة 92% من الارتباط المالي لأمر التكليف');
  });

  it('exactly at the limit is a warning, not exceeded', () => {
    const s = commitmentState({ aoValue: 1_000_000, financialCommitment: 1_000_000, billedCumulative: 1_000_000 });
    expect(s).toMatchObject({ exceeded: false, level: 'warn', pct: 100, partial: false });
  });

  it('above the limit is exceeded with a renewal warning', () => {
    const s = commitmentState({ aoValue: 1_000_000, financialCommitment: 600_000, billedCumulative: 600_000.01 });
    expect(s).toMatchObject({ exceeded: true, level: 'exceeded', cls: 'r' });
    expect(s.warning).toBe('القيمة المفوترة على أمر التكليف (600,000) تجاوزت الارتباط المالي المعتمد (600,000) — يلزم تعزيز الارتباط المالي قبل السداد');
  });

  it('zero commitment falls back to AO value; custom warn threshold', () => {
    expect(commitmentState({ aoValue: 100, financialCommitment: 0, billedCumulative: 80 }).limit).toBe(100);
    expect(commitmentState({ aoValue: 100, financialCommitment: null, billedCumulative: 80 }, 75).level).toBe('warn');
  });

  it('zero limit with billing is 100% and exceeded', () => {
    expect(commitmentState({ aoValue: 0, financialCommitment: null, billedCumulative: 10 })).toMatchObject({ pct: 100, exceeded: true });
  });
});
