import { workingDaysBetween, type DateInput, type Holidays } from './calendar';
import type { StepAction } from './types';

/*
 * الأزمنة من سجل الحركة (step_log): كام يوم عمل قعد المستخلص في كل مرحلة، وكام يوم عند المقاول.
 * التواريخ كلها محلية (استخدم localDate() للـ timestamps).
 */

export interface CycleLogEntry {
  action: StepAction;
  fromStep: string | null;
  toStep: string | null;
  at: DateInput;
}

export interface StepSegment {
  /** المحطة اللي الأيام اتحسبت عليها ('company' = المقاول بعد الإعادة) */
  step: string;
  days: number;
  /** لسه مفتوحة (المستخلص واقف عندها دلوقتي) */
  open: boolean;
}

/** الحركات اللي بتبدأ فترة عند `toStep` */
const STARTS: ReadonlySet<StepAction> = new Set<StepAction>(['submit', 'approve', 'resubmit', 'release', 'return']);
/** الحركات اللي بتقفل الفترة المفتوحة عند `fromStep` (الإيقاف المؤقت بيوقف العداد) */
const ENDS: ReadonlySet<StepAction> = new Set<StepAction>(['approve', 'return', 'pay', 'hold', 'resubmit']);

/**
 * فترات المحطات بالترتيب. الإعادة لمحطة سابقة أو للمقاول بتفتح فترة عند الجهة اللي اتعادلها،
 * وإعادة التقديم بتقفلها. `end` = تاريخ السداد أو النهارده.
 */
export function stepSegments(log: readonly CycleLogEntry[], end: DateInput, holidays: Holidays = []): StepSegment[] {
  const out: StepSegment[] = [];
  log.forEach((e, i) => {
    if (!STARTS.has(e.action) || !e.toStep || e.toStep === 'done') return;
    const next = log.slice(i + 1).find((x) => ENDS.has(x.action) && x.fromStep === e.toStep);
    out.push({ step: e.toStep, days: workingDaysBetween(e.at, next ? next.at : end, holidays), open: !next });
  });
  return out;
}

/** مجموع أيام كل محطة (لشريط المسار). */
export function daysByStep(segments: readonly StepSegment[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of segments) out[s.step] = (out[s.step] ?? 0) + s.days;
  return out;
}

export interface CycleDays {
  /** أيام العمل من أول تقديم لحد السداد / النهارده (null لو لسه ما اتقدمش) */
  total: number | null;
  /** منها أيام عند المقاول (بعد الإعادة للاستيفاء) */
  company: number;
}

export function cycleDays(log: readonly CycleLogEntry[], end: DateInput, holidays: Holidays = []): CycleDays {
  const submit = log.find((e) => e.action === 'submit');
  if (!submit) return { total: null, company: 0 };
  const company = stepSegments(log, end, holidays)
    .filter((s) => s.step === 'company')
    .reduce((a, s) => a + s.days, 0);
  return { total: workingDaysBetween(submit.at, end, holidays), company };
}
