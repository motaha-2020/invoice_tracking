import { workingDaysBetween, type DateInput, type Holidays } from './calendar';
import type { CategoryCode } from './category';
import type { InvoiceStatus, StatusColor } from './types';
import type { ReturnTarget } from './transition';
import { effectiveCategory, slaDaysFor, type StepKey, type WorkflowConfig } from './workflow';

/** يتلوّن أصفر لما يفضل يوم عمل واحد أو أقل (الافتراضي). */
export const DEFAULT_SLA_WARN_AT = 1;

export type SlaKind = 'ok' | 'due' | 'late' | 'nosla' | 'returned' | 'hold' | 'draft' | 'paid';

export interface SlaInput {
  status: InvoiceStatus;
  /** بداية المحطة الحالية — تاريخ محلي (استخدم localDate() للـ timestamps) */
  since: DateInput;
  currentStep: StepKey | null;
  category: CategoryCode | null;
  suggestedCategory?: CategoryCode | null;
  returnTo?: ReturnTarget | null;
  holdReason?: string | null;
}

export interface SlaState {
  k: SlaKind;
  cls: StatusColor;
  label: string;
  /** أيام العمل من `since` لحد النهارده (null للمسودة والمصروف) */
  elapsed: number | null;
  sla: number | null;
}

function returnedLabel(returnTo: ReturnTarget | null | undefined, config: WorkflowConfig): string {
  if (!returnTo || returnTo === 'company') return 'معاد للاستيفاء — المقاول';
  return `معاد للاستيفاء — ${config.steps[returnTo]?.short ?? returnTo}`;
}

/** حالة الـ SLA للمحطة الحالية: في الميعاد / قرب الميعاد / متأخر … */
export function slaState(
  inv: SlaInput,
  today: DateInput,
  config: WorkflowConfig,
  holidays: Holidays = [],
  warnAt: number = DEFAULT_SLA_WARN_AT,
): SlaState {
  if (inv.status === 'paid') return { k: 'paid', cls: 'g', label: 'تم السداد', elapsed: null, sla: null };
  if (inv.status === 'draft') return { k: 'draft', cls: 'n', label: 'مسودة', elapsed: null, sla: null };
  const elapsed = workingDaysBetween(inv.since, today, holidays);
  if (inv.status === 'on_hold') {
    return { k: 'hold', cls: 'a', label: `موقوف مؤقتاً: ${inv.holdReason || 'بانتظار اعتماد أمر التكليف'}`, elapsed, sla: null };
  }
  if (inv.status === 'returned') return { k: 'returned', cls: 'b', label: returnedLabel(inv.returnTo, config), elapsed, sla: null };
  const sla = inv.currentStep ? slaDaysFor(config, effectiveCategory(inv), inv.currentStep) : null;
  if (sla == null) return { k: 'nosla', cls: 'n', label: 'دون مدة مستهدفة', elapsed, sla };
  if (elapsed > sla) return { k: 'late', cls: 'r', label: 'متجاوز للمدة', elapsed, sla };
  if (sla - elapsed <= warnAt) return { k: 'due', cls: 'a', label: 'قارب على الانتهاء', elapsed, sla };
  return { k: 'ok', cls: 'g', label: 'ضمن المدة', elapsed, sla };
}
