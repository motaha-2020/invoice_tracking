import { describe, expect, it } from 'vitest';
import { slaState, type SlaInput } from './sla';
import { DEFAULT_WORKFLOW as W } from './workflow';

// الأحد 2026-10-11 ← الخميس 15 = 4 أيام عمل
const SINCE = '2026-10-11';
const at = (over: Partial<SlaInput>): SlaInput => ({
  status: 'active', since: SINCE, currentStep: 'tech', category: 'C1', ...over,
});

describe('slaState', () => {
  it('paid and draft have no elapsed time', () => {
    expect(slaState(at({ status: 'paid' }), '2026-10-15', W)).toMatchObject({ k: 'paid', cls: 'g', elapsed: null });
    expect(slaState(at({ status: 'draft' }), '2026-10-15', W)).toMatchObject({ k: 'draft', cls: 'n', label: 'مسودة' });
  });

  it('ok → due (warning) → last day → late for tech in C1 (SLA 2)', () => {
    expect(slaState(at({}), '2026-10-11', W)).toMatchObject({ k: 'ok', cls: 'g', elapsed: 0, sla: 2 });
    expect(slaState(at({}), '2026-10-12', W)).toMatchObject({ k: 'due', cls: 'a', label: 'قرب الميعاد', elapsed: 1 });
    expect(slaState(at({}), '2026-10-13', W)).toMatchObject({ k: 'due', label: 'آخر يوم', elapsed: 2 });
    expect(slaState(at({}), '2026-10-14', W)).toMatchObject({ k: 'late', cls: 'r', label: 'متأخر', elapsed: 3 });
  });

  it('uses the SLA of the effective category path', () => {
    expect(slaState(at({ category: 'C2' }), '2026-10-13', W)).toMatchObject({ k: 'ok', sla: 4 });
    expect(slaState(at({ category: null, suggestedCategory: 'C2' }), '2026-10-13', W).sla).toBe(4);
  });

  it('holidays and weekends do not count', () => {
    expect(slaState(at({}), '2026-10-14', W, ['2026-10-12', '2026-10-13']).k).toBe('due');
    // الخميس ← الأحد = يوم واحد
    expect(slaState(at({ since: '2026-10-15' }), '2026-10-18', W).elapsed).toBe(1);
  });

  it('honours a custom warnAt', () => {
    expect(slaState(at({ category: 'C2' }), '2026-10-12', W, [], 3).k).toBe('due');
    expect(slaState(at({}), '2026-10-12', W, [], 0).k).toBe('ok');
  });

  it('nosla for the supervisor step', () => {
    expect(slaState(at({ currentStep: 'sup' }), '2026-10-15', W)).toMatchObject({ k: 'nosla', cls: 'n', sla: null, elapsed: 4 });
  });

  it('returned shows who it was returned to', () => {
    expect(slaState(at({ status: 'returned', returnTo: 'company' }), '2026-10-15', W)).toMatchObject({ k: 'returned', cls: 'b', label: 'مرتجع للشركة', elapsed: 4 });
    expect(slaState(at({ status: 'returned', returnTo: 'exec' }), '2026-10-15', W).label).toBe('مرتجع لـ إدارة التنفيذ');
  });

  it('on hold shows the reason', () => {
    const s = slaState(at({ status: 'on_hold', holdReason: 'بانتظار ملحق الزيادة' }), '2026-10-15', W);
    expect(s).toMatchObject({ k: 'hold', cls: 'a', label: 'معلّق: بانتظار ملحق الزيادة', sla: null });
  });
});
