import { describe, expect, it } from 'vitest';
import { computeKpis, invoiceMetrics, type KpiInvoice } from './kpis';
import { DEFAULT_WORKFLOW } from './workflow';

// C1: sup (بدون مدة) → exec 2 → gm 1 → tech 2 → stores 2 → finance 3
const o = { config: DEFAULT_WORKFLOW, holidays: [], today: '2026-10-30' };

const paid: KpiInvoice = {
  status: 'paid', category: 'C1', submittedAt: '2026-10-04', paidAt: '2026-10-15', gross: 1000, reasons: ['توقيع ناقص'],
  log: [
    { action: 'submit', fromStep: 'company', toStep: 'sup', at: '2026-10-04' },
    { action: 'approve', fromStep: 'sup', toStep: 'exec', at: '2026-10-05' },
    { action: 'return', fromStep: 'exec', toStep: 'company', at: '2026-10-08' }, // exec 3 > 2 متأخر
    { action: 'resubmit', fromStep: 'company', toStep: 'exec', at: '2026-10-12' }, // المقاول 2 يوم
    { action: 'approve', fromStep: 'exec', toStep: 'gm', at: '2026-10-12' }, // exec 0
    { action: 'approve', fromStep: 'gm', toStep: 'finance', at: '2026-10-13' }, // gm 1
    { action: 'pay', fromStep: 'finance', toStep: 'done', at: '2026-10-15' }, // finance 2
  ],
};
const open: KpiInvoice = {
  status: 'active', category: 'C1', submittedAt: '2026-10-01', paidAt: null, gross: 500, reasons: [],
  log: [
    { action: 'submit', fromStep: 'company', toStep: 'sup', at: '2026-10-01' },
    { action: 'approve', fromStep: 'sup', toStep: 'exec', at: '2026-10-01' },
  ],
};
const draft: KpiInvoice = { status: 'draft', category: 'C1', submittedAt: null, paidAt: null, gross: 9, reasons: [], log: [] };

describe('invoiceMetrics', () => {
  it('splits contractor days and counts on-time steps with a target', () => {
    const m = invoiceMetrics(paid, o);
    expect(m.cycle).toBe(9);
    expect(m.companyDays).toBe(2);
    expect(m.returns).toBe(1);
    // المراحل اللي ليها مدة: exec(3>2) exec(0) gm(1) finance(2) — sup مالهاش مدة
    expect(m.stepsDone).toBe(4);
    expect(m.stepsOnTime).toBe(3);
  });
});

describe('computeKpis', () => {
  const k = computeKpis([paid, open, draft], o);
  it('counts invoices and money', () => {
    expect(k).toMatchObject({ total: 3, submitted: 2, open: 1, paid: 1, grossSubmitted: 1500, grossPaid: 1000 });
  });
  it('computes SLA compliance, cycle, contractor share and return rate', () => {
    expect(k.slaCompliance).toEqual({ onTime: 3, total: 4, pct: 75 });
    expect(k.avgCycle).toBe(9);
    expect(k.avgCycleBasis).toBe('paid');
    expect(k.companySharePct).toBe(22.22);
    expect(k.returnRate).toEqual({ returnedOnce: 1, submitted: 2, pct: 50 });
    expect(k.topReasons).toEqual([{ name: 'توقيع ناقص', count: 1 }]);
  });
  it('aggregates by step and ages open invoices', () => {
    const exec = k.byStep.find((s) => s.step === 'exec')!;
    expect(exec).toMatchObject({ count: 2, late: 1, avgOver: 1, openNow: 1 });
    expect(k.aging.find((a) => a.key === '11-20')!.count).toBe(1);
  });
  it('handles an empty list', () => {
    const e = computeKpis([], o);
    expect(e.slaCompliance.pct).toBeNull();
    expect(e.avgCycle).toBeNull();
  });
});
