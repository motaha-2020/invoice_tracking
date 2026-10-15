import type { CategoryCode } from './category';
import { DomainError } from './errors';
import type { InvoiceStatus, StepAction } from './types';
import {
  CATEGORY_STEP, effectiveCategory, nextStep, pathFor, previousSteps, stepDef, stepIndex,
  type StepKey, type WorkflowConfig,
} from './workflow';

/*
 * آلة الحالة للمستخلص — دالة pure: (state, command) ← { state جديدة، logEntry }.
 * الـ service بيحفظ الـ state ويسجّل الـ logEntry + audit + الإشعارات في transaction واحدة،
 * وبيصفّر `since` لما resetsClock = true.
 */

/** الجهة اللي المستخلص راجع لها: الشركة أو محطة سابقة. */
export type ReturnTarget = 'company' | StepKey;

export interface InvoiceFlowState {
  status: InvoiceStatus;
  currentStep: StepKey | null;
  category: CategoryCode | null;
  suggestedCategory: CategoryCode | null;
  returnTo: ReturnTarget | null;
  returnedFrom: StepKey | null;
  heldAt: StepKey | null;
  holdReason: string | null;
}

export type FlowCommand =
  | { type: 'submit'; suggestedCategory?: CategoryCode | null; note?: string }
  | { type: 'setCategory'; category: CategoryCode; note?: string }
  | { type: 'approve'; note?: string }
  | { type: 'return'; target: ReturnTarget; reasonIds: readonly string[]; note: string }
  | { type: 'resubmit'; suggestedCategory?: CategoryCode | null; note?: string }
  | { type: 'hold'; reason: string }
  | { type: 'release'; note?: string }
  | { type: 'pay'; ref: string; note?: string };

/** سطر في step_log. from/to = محطة أو 'company'، و'done' بعد الصرف. */
export interface FlowLogEntry {
  action: StepAction;
  fromStep: ReturnTarget | null;
  toStep: ReturnTarget | 'done' | null;
  note: string | null;
  reasonIds?: readonly string[];
  category?: CategoryCode;
  ref?: string;
}

export interface TransitionResult {
  state: InvoiceFlowState;
  logEntry: FlowLogEntry;
  /** هل عداد الـ SLA يبدأ من جديد (since = الآن)؟ */
  resetsClock: boolean;
}

/** مستخلص جديد (مسودة). */
export const INITIAL_FLOW_STATE: InvoiceFlowState = {
  status: 'draft', currentStep: null, category: null, suggestedCategory: null,
  returnTo: null, returnedFrom: null, heldAt: null, holdReason: null,
};

const clean = (s: string | undefined): string | null => (s && s.trim() ? s.trim() : null);

function requireStatus(state: InvoiceFlowState, allowed: InvoiceStatus, actionAr: string): void {
  if (state.status !== allowed) {
    throw new DomainError('INVALID_STATE', `مينفعش ${actionAr} والمستخلص حالته ${STATUS_AR[state.status]}`);
  }
}

function requireStep(state: InvoiceFlowState): StepKey {
  if (!state.currentStep) throw new DomainError('INVALID_STATE', 'المستخلص مش واقف على أي محطة');
  return state.currentStep;
}

const STATUS_AR: Record<InvoiceStatus, string> = {
  draft: 'مسودة', active: 'جاري', returned: 'مرتجع', on_hold: 'معلّق', paid: 'مصروف',
};

function submit(state: InvoiceFlowState, cmd: Extract<FlowCommand, { type: 'submit' }>, config: WorkflowConfig): TransitionResult {
  requireStatus(state, 'draft', 'تقديم المستخلص');
  const suggestedCategory = cmd.suggestedCategory ?? state.suggestedCategory;
  const first = pathFor(config, effectiveCategory({ category: state.category, suggestedCategory }))[0];
  if (!first) throw new DomainError('UNKNOWN_STEP', 'مسار الفئة فاضي');
  return {
    state: { ...state, status: 'active', currentStep: first.step, suggestedCategory },
    logEntry: { action: 'submit', fromStep: 'company', toStep: first.step, note: clean(cmd.note) ?? 'تم تقديم المستخلص' },
    resetsClock: true,
  };
}

function setCategory(state: InvoiceFlowState, cmd: Extract<FlowCommand, { type: 'setCategory' }>, config: WorkflowConfig): TransitionResult {
  requireStatus(state, 'active', 'تغيير الفئة');
  const step = requireStep(state);
  if (stepIndex(config, cmd.category, step) < 0) {
    throw new DomainError('STEP_NOT_IN_PATH', `المحطة الحالية (${stepDef(config, step).short}) مش في مسار الفئة ${cmd.category}`);
  }
  const old = state.category;
  const note = clean(cmd.note) ?? (old ? `تغيير الفئة من ${old} إلى ${cmd.category}` : `تحديد الفئة ${cmd.category} — ${config.categories[cmd.category].name}`);
  return {
    state: { ...state, category: cmd.category },
    logEntry: { action: 'category', fromStep: step, toStep: step, note, category: cmd.category },
    resetsClock: false,
  };
}

function approve(state: InvoiceFlowState, cmd: Extract<FlowCommand, { type: 'approve' }>, config: WorkflowConfig): TransitionResult {
  requireStatus(state, 'active', 'الاعتماد');
  const step = requireStep(state);
  if (step === CATEGORY_STEP && !state.category) {
    throw new DomainError('CATEGORY_REQUIRED', 'لازم تحدد الفئة قبل الاعتماد');
  }
  const next = nextStep(config, effectiveCategory(state), step);
  if (!next) throw new DomainError('PAY_REQUIRED', 'دي آخر محطة — سجّل الصرف برقم الشيك/التحويل');
  return {
    state: { ...state, currentStep: next },
    logEntry: { action: 'approve', fromStep: step, toStep: next, note: clean(cmd.note) },
    resetsClock: true,
  };
}

function validateReturn(state: InvoiceFlowState, cmd: Extract<FlowCommand, { type: 'return' }>, config: WorkflowConfig, step: StepKey): void {
  if (!cmd.reasonIds.length) throw new DomainError('REASON_REQUIRED', 'لازم تختار سبب واحد على الأقل للإرجاع');
  if (!clean(cmd.note)) throw new DomainError('NOTE_REQUIRED', 'لازم تكتب ملاحظة توضّح المطلوب');
  if (cmd.target === 'company') return;
  if (!previousSteps(config, effectiveCategory(state), step).includes(cmd.target)) {
    throw new DomainError('INVALID_RETURN_TARGET', 'الإرجاع بيكون للشركة أو لمحطة قبل المحطة الحالية في المسار');
  }
}

function returnInvoice(state: InvoiceFlowState, cmd: Extract<FlowCommand, { type: 'return' }>, config: WorkflowConfig): TransitionResult {
  requireStatus(state, 'active', 'الإرجاع');
  const step = requireStep(state);
  validateReturn(state, cmd, config, step);
  return {
    state: { ...state, status: 'returned', returnTo: cmd.target, returnedFrom: step },
    logEntry: { action: 'return', fromStep: step, toStep: cmd.target, note: clean(cmd.note), reasonIds: [...cmd.reasonIds] },
    resetsClock: true,
  };
}

/** إعادة الإرسال بترجع للمحطة اللي رجّعت (مش من أول المسار). */
function resubmit(state: InvoiceFlowState, cmd: Extract<FlowCommand, { type: 'resubmit' }>): TransitionResult {
  requireStatus(state, 'returned', 'إعادة الإرسال');
  const back = state.returnedFrom;
  if (!back) throw new DomainError('INVALID_STATE', 'مش معروف المستخلص اترجع من أنهي محطة');
  return {
    state: {
      ...state, status: 'active', currentStep: back, returnTo: null, returnedFrom: null,
      suggestedCategory: cmd.suggestedCategory ?? state.suggestedCategory,
    },
    logEntry: { action: 'resubmit', fromStep: state.returnTo, toStep: back, note: clean(cmd.note) ?? 'تم استيفاء الملاحظات' },
    resetsClock: true,
  };
}

function hold(state: InvoiceFlowState, cmd: Extract<FlowCommand, { type: 'hold' }>): TransitionResult {
  requireStatus(state, 'active', 'التعليق');
  const step = requireStep(state);
  const reason = clean(cmd.reason);
  if (!reason) throw new DomainError('NOTE_REQUIRED', 'لازم تكتب سبب التعليق');
  return {
    state: { ...state, status: 'on_hold', heldAt: step, holdReason: reason },
    logEntry: { action: 'hold', fromStep: step, toStep: step, note: reason },
    resetsClock: true,
  };
}

function release(state: InvoiceFlowState, cmd: Extract<FlowCommand, { type: 'release' }>): TransitionResult {
  requireStatus(state, 'on_hold', 'رفع التعليق');
  const step = state.heldAt ?? requireStep(state);
  return {
    state: { ...state, status: 'active', currentStep: step, heldAt: null, holdReason: null },
    logEntry: { action: 'release', fromStep: step, toStep: step, note: clean(cmd.note) ?? 'تم رفع التعليق' },
    resetsClock: true,
  };
}

function pay(state: InvoiceFlowState, cmd: Extract<FlowCommand, { type: 'pay' }>, config: WorkflowConfig): TransitionResult {
  requireStatus(state, 'active', 'الصرف');
  const step = requireStep(state);
  const ref = clean(cmd.ref);
  if (!ref) throw new DomainError('REF_REQUIRED', 'لازم تكتب رقم الشيك أو التحويل');
  if (nextStep(config, effectiveCategory(state), step) !== null) {
    throw new DomainError('NOT_LAST_STEP', 'الصرف بيكون في آخر محطة في المسار بس');
  }
  return {
    state: { ...state, status: 'paid', currentStep: null },
    logEntry: { action: 'pay', fromStep: step, toStep: 'done', note: clean(cmd.note) ?? `تم الصرف — رقم ${ref}`, ref },
    resetsClock: true,
  };
}

/** يطبّق أمر على حالة المستخلص. بيرمي DomainError لو الحركة مخالفة للقواعد. */
export function transition(state: InvoiceFlowState, command: FlowCommand, config: WorkflowConfig): TransitionResult {
  switch (command.type) {
    case 'submit': return submit(state, command, config);
    case 'setCategory': return setCategory(state, command, config);
    case 'approve': return approve(state, command, config);
    case 'return': return returnInvoice(state, command, config);
    case 'resubmit': return resubmit(state, command);
    case 'hold': return hold(state, command);
    case 'release': return release(state, command);
    case 'pay': return pay(state, command, config);
  }
}
