import type { Holidays } from './calendar';
import type { CategoryCode } from './category';
import { cycleDays, stepSegments, type CycleLogEntry } from './cycle';
import { round2 } from './money';
import type { InvoiceStatus } from './types';
import { slaDaysFor, type WorkflowConfig } from './workflow';

/*
 * مؤشرات الأداء (لوحة PMO + التقارير + التقرير الأسبوعي). كل الأيام أيام عمل.
 *
 *   نسبة الالتزام بالمدة   = المراحل المنتهية في حدود المدة المستهدفة ÷ المراحل المنتهية اللي ليها مدة × 100
 *   متوسط مدة الدورة      = متوسط (أيام العمل من أول تقديم لحد السداد) للمستخلصات المسددة
 *   نسبة أيام المقاول     = مجموع الأيام لدى المقاول بعد الإعادة ÷ مجموع أيام الدورة × 100
 *   نسبة الإعادة          = المستخلصات المقدمة اللي اتعادت مرة أو أكتر ÷ المستخلصات المقدمة × 100
 *   أعمار المفتوح         = المستخلصات المفتوحة موزعة على شرائح حسب أيام العمل من التقديم
 */

export interface KpiInvoice {
  status: InvoiceStatus;
  /** الفئة الفعلية (المعتمدة أو المقترحة) */
  category: CategoryCode;
  /** تاريخ أول تقديم (محلي) — null للمسودة */
  submittedAt: string | null;
  paidAt: string | null;
  gross: number;
  log: readonly CycleLogEntry[];
  /** أسماء أسباب الإعادة (سبب لكل مرة) */
  reasons: readonly string[];
}

export interface KpiOptions {
  config: WorkflowConfig;
  holidays: Holidays;
  today: string;
}

export interface InvoiceMetrics {
  cycle: number | null;
  companyDays: number;
  returns: number;
  /** المراحل المنتهية اللي ليها مدة مستهدفة، واللي خلصت في الميعاد منها */
  stepsDone: number;
  stepsOnTime: number;
  segments: { step: string; days: number; sla: number | null; open: boolean }[];
}

export function invoiceMetrics(inv: KpiInvoice, o: KpiOptions): InvoiceMetrics {
  const end = inv.paidAt ?? o.today;
  const segs = inv.submittedAt ? stepSegments(inv.log, end, o.holidays) : [];
  const segments = segs.map((s) => ({ ...s, sla: s.step === 'company' ? null : safeSla(o.config, inv.category, s.step) }));
  const done = segments.filter((s) => !s.open && s.sla != null);
  const c = cycleDays(inv.log, end, o.holidays);
  return {
    cycle: c.total,
    companyDays: c.company,
    returns: inv.log.filter((e) => e.action === 'return').length,
    stepsDone: done.length,
    stepsOnTime: done.filter((s) => s.days <= (s.sla ?? 0)).length,
    segments,
  };
}

function safeSla(config: WorkflowConfig, cat: CategoryCode, step: string): number | null {
  try {
    return slaDaysFor(config, cat, step);
  } catch {
    return null;
  }
}

export interface StepKpi {
  step: string;
  /** عدد مرات مرور المستخلصات بالمرحلة (المنتهية) */
  count: number;
  avgDays: number;
  late: number;
  /** متوسط أيام التجاوز للمرات المتأخرة */
  avgOver: number;
  /** واقف عندها دلوقتي */
  openNow: number;
}

export const AGING_BUCKETS = [
  { key: '0-10', label: 'حتى 10 أيام', max: 10 },
  { key: '11-20', label: 'من 11 إلى 20 يوماً', max: 20 },
  { key: '21-40', label: 'من 21 إلى 40 يوماً', max: 40 },
  { key: '40+', label: 'أكثر من 40 يوماً', max: Number.POSITIVE_INFINITY },
] as const;

export interface Kpis {
  total: number;
  submitted: number;
  open: number;
  paid: number;
  returned: number;
  onHold: number;
  grossSubmitted: number;
  grossPaid: number;
  slaCompliance: { onTime: number; total: number; pct: number | null };
  avgCycle: number | null;
  /** المتوسط محسوب على المسدد بس، ولو مفيش مسدد على كل المقدم */
  avgCycleBasis: 'paid' | 'submitted' | null;
  companySharePct: number | null;
  returnRate: { returnedOnce: number; submitted: number; pct: number | null };
  topReasons: { name: string; count: number }[];
  byStep: StepKpi[];
  aging: { key: string; label: string; count: number }[];
}

const pct = (a: number, b: number): number | null => (b > 0 ? round2((a / b) * 100) : null);
const avg = (xs: readonly number[]): number | null => (xs.length ? round2(xs.reduce((a, x) => a + x, 0) / xs.length) : null);

export function computeKpis(list: readonly KpiInvoice[], o: KpiOptions): Kpis {
  const rows = list.map((inv) => ({ inv, m: invoiceMetrics(inv, o) }));
  const submitted = rows.filter((r) => r.inv.submittedAt);
  const paid = submitted.filter((r) => r.inv.status === 'paid');
  const open = submitted.filter((r) => r.inv.status !== 'paid');
  const basis = paid.length ? paid : submitted;

  const steps = new Map<string, { days: number[]; over: number[]; open: number }>();
  for (const { m } of submitted) {
    for (const s of m.segments) {
      if (s.step === 'company') continue;
      const e = steps.get(s.step) ?? { days: [], over: [], open: 0 };
      if (s.open) e.open++;
      else {
        e.days.push(s.days);
        if (s.sla != null && s.days > s.sla) e.over.push(s.days - s.sla);
      }
      steps.set(s.step, e);
    }
  }
  const order = Object.keys(o.config.steps);
  const byStep: StepKpi[] = [...steps.entries()]
    .map(([step, e]) => ({ step, count: e.days.length, avgDays: avg(e.days) ?? 0, late: e.over.length, avgOver: avg(e.over) ?? 0, openNow: e.open }))
    .sort((a, b) => order.indexOf(a.step) - order.indexOf(b.step));

  const reasons = new Map<string, number>();
  for (const { inv } of submitted) for (const r of inv.reasons) reasons.set(r, (reasons.get(r) ?? 0) + 1);

  const onTime = submitted.reduce((a, r) => a + r.m.stepsOnTime, 0);
  const done = submitted.reduce((a, r) => a + r.m.stepsDone, 0);
  const cycleSum = basis.reduce((a, r) => a + (r.m.cycle ?? 0), 0);
  const companySum = basis.reduce((a, r) => a + r.m.companyDays, 0);
  const returnedOnce = submitted.filter((r) => r.m.returns > 0).length;

  const aging = AGING_BUCKETS.map((b) => ({ key: b.key, label: b.label, count: 0 }));
  for (const r of open) {
    const d = r.m.cycle ?? 0;
    const i = AGING_BUCKETS.findIndex((b) => d <= b.max);
    aging[i]!.count++;
  }

  return {
    total: list.length,
    submitted: submitted.length,
    open: open.length,
    paid: paid.length,
    returned: submitted.filter((r) => r.inv.status === 'returned').length,
    onHold: submitted.filter((r) => r.inv.status === 'on_hold').length,
    grossSubmitted: round2(submitted.reduce((a, r) => a + r.inv.gross, 0)),
    grossPaid: round2(paid.reduce((a, r) => a + r.inv.gross, 0)),
    slaCompliance: { onTime, total: done, pct: pct(onTime, done) },
    avgCycle: avg(basis.map((r) => r.m.cycle ?? 0)),
    avgCycleBasis: paid.length ? 'paid' : submitted.length ? 'submitted' : null,
    companySharePct: pct(companySum, cycleSum),
    returnRate: { returnedOnce, submitted: submitted.length, pct: pct(returnedOnce, submitted.length) },
    topReasons: [...reasons.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    byStep,
    aging,
  };
}
