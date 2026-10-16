import type { CategoryCode } from './category';
import { DomainError } from './errors';
import type { Role } from './types';

/*
 * إعدادات المسار: المحطات، والمسار + SLA (أيام عمل) لكل فئة.
 * DEFAULT_WORKFLOW = الافتراضي من الديمو، والحقيقي بيتقري من جداول workflow_steps / category_steps.
 */

/** مفتاح محطة. المحطات الافتراضية في DEFAULT_STEP_KEYS، والإعدادات ممكن تضيف غيرها. */
export type StepKey = string;

export const DEFAULT_STEP_KEYS = [
  'sup', 'exec', 'gm', 'tech', 'plan', 'pres', 'committee', 'pricing', 'sector', 'stores', 'finance',
] as const;
export type DefaultStepKey = (typeof DEFAULT_STEP_KEYS)[number];

/** المحطة اللي لازم الفئة تتحدد فيها قبل الاعتماد. */
export const CATEGORY_STEP: StepKey = 'exec';

export interface StepDef {
  name: string;
  short: string;
  role: Role;
}

export interface PathStep {
  step: StepKey;
  /** أيام عمل. null = من غير SLA */
  slaDays: number | null;
}

export interface CategoryDef {
  name: string;
  path: readonly PathStep[];
}

export interface WorkflowConfig {
  steps: Readonly<Record<StepKey, StepDef>>;
  categories: Readonly<Record<CategoryCode, CategoryDef>>;
}

const p = (step: DefaultStepKey, slaDays: number | null): PathStep => ({ step, slaDays });
const HEAD = [p('sup', null), p('exec', 1), p('gm', 1), p('tech', 4), p('plan', 3)];
const TAIL = [p('sector', 1), p('stores', 2), p('finance', 3)];

export const DEFAULT_WORKFLOW: WorkflowConfig = {
  steps: {
    sup: { name: 'مراجعة مشرف التنفيذ', short: 'مشرف التنفيذ', role: 'supervisor' },
    exec: { name: 'مراجعة واعتماد مدير التنفيذ', short: 'إدارة التنفيذ', role: 'exec_mgr' },
    gm: { name: 'مراجعة واعتماد المدير العام', short: 'المدير العام', role: 'gm' },
    tech: { name: 'المراجعة الفنية — الشئون الفنية', short: 'الشئون الفنية', role: 'tech_affairs' },
    plan: { name: 'مراجعة التخطيط', short: 'التخطيط', role: 'planning' },
    pres: { name: 'موافقة رئاسة القطاعات', short: 'رئاسة القطاعات', role: 'presidency_head' },
    committee: { name: 'اللجنة العليا', short: 'اللجنة العليا', role: 'committee' },
    pricing: { name: 'تسعير البند المستجد', short: 'التسعير', role: 'planning' },
    sector: { name: 'اعتماد رئيس القطاع', short: 'رئيس القطاع', role: 'sector_head' },
    stores: { name: 'مراجعة المخازن والمشتريات', short: 'المخازن والمشتريات', role: 'stores' },
    finance: { name: 'السداد — الإدارة المالية', short: 'الإدارة المالية', role: 'finance' },
  },
  categories: {
    C1: {
      name: 'لا يوجد تجاوز في البنود أو في إجمالي أمر التكليف',
      path: [p('sup', null), p('exec', 2), p('gm', 1), p('tech', 2), p('stores', 2), p('finance', 3)],
    },
    C2: { name: 'تجاوز في بند أو أكثر دون تجاوز إجمالي أمر التكليف', path: [...HEAD, p('stores', 2), p('finance', 3)] },
    C3: { name: 'تجاوز إجمالي أمر التكليف بنسبة لا تزيد على 25%', path: [...HEAD, ...TAIL] },
    C4: { name: 'تجاوز إجمالي أمر التكليف بنسبة تزيد على 25%', path: [...HEAD, p('pres', 1), p('committee', 7), ...TAIL] },
    C5: {
      name: 'بند مستجد غير مُسعّر في التعاقد',
      path: [...HEAD, p('pricing', 10), p('pres', 1), p('committee', 7), ...TAIL],
    },
  },
};

/** تعريف المحطة، أو DomainError لو مش موجودة في الإعدادات. */
export function stepDef(config: WorkflowConfig, step: StepKey): StepDef {
  const def = config.steps[step];
  if (!def) throw new DomainError('UNKNOWN_STEP', `مرحلة اعتماد غير معروفة: ${step}`);
  return def;
}

/** مسار الفئة (المحطات بالترتيب مع الـ SLA). */
export function pathFor(config: WorkflowConfig, category: CategoryCode): readonly PathStep[] {
  const def = config.categories[category];
  if (!def) throw new DomainError('UNKNOWN_CATEGORY', `فئة غير معروفة: ${category}`);
  return def.path;
}

/** ترتيب المحطة في مسار الفئة (-1 لو مش فيه). */
export function stepIndex(config: WorkflowConfig, category: CategoryCode, step: StepKey): number {
  return pathFor(config, category).findIndex((s) => s.step === step);
}

/** المحطة اللي بعدها في المسار، أو null لو دي آخر محطة. بيرمي لو المحطة مش في المسار. */
export function nextStep(config: WorkflowConfig, category: CategoryCode, step: StepKey): StepKey | null {
  const path = pathFor(config, category);
  const i = stepIndex(config, category, step);
  if (i < 0) throw new DomainError('STEP_NOT_IN_PATH', `مرحلة الاعتماد ${step} غير مدرجة في مسار الفئة ${category}`);
  return path[i + 1]?.step ?? null;
}

/** المحطات اللي قبل المحطة دي في المسار (الأقدم الأول) — أهداف الإرجاع المسموحة. */
export function previousSteps(config: WorkflowConfig, category: CategoryCode, step: StepKey): StepKey[] {
  const i = stepIndex(config, category, step);
  if (i < 0) throw new DomainError('STEP_NOT_IN_PATH', `مرحلة الاعتماد ${step} غير مدرجة في مسار الفئة ${category}`);
  return pathFor(config, category).slice(0, i).map((s) => s.step);
}

/** SLA المحطة في مسار الفئة (null لو من غير SLA أو المحطة مش في المسار). */
export function slaDaysFor(config: WorkflowConfig, category: CategoryCode, step: StepKey): number | null {
  return pathFor(config, category).find((s) => s.step === step)?.slaDays ?? null;
}

/** إجمالي SLA للمسار (أيام عمل). */
export function totalSlaDays(config: WorkflowConfig, category: CategoryCode): number {
  return pathFor(config, category).reduce((acc, s) => acc + (s.slaDays ?? 0), 0);
}

/** الفئة اللي المسار ماشي عليها: المعتمدة، ولو لسه ما اتحددتش المقترحة، وإلا C1. */
export function effectiveCategory(state: { category: CategoryCode | null; suggestedCategory?: CategoryCode | null }): CategoryCode {
  return state.category ?? state.suggestedCategory ?? 'C1';
}
