import { describe, expect, it } from 'vitest';
import { DomainError, type DomainErrorCode } from './errors';
import { INITIAL_FLOW_STATE, transition, type FlowCommand, type InvoiceFlowState } from './transition';
import { DEFAULT_WORKFLOW as W } from './workflow';

const run = (state: InvoiceFlowState, ...cmds: FlowCommand[]): InvoiceFlowState =>
  cmds.reduce((s, c) => transition(s, c, W).state, state);

function expectCode(fn: () => unknown, code: DomainErrorCode): void {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe(code);
    expect((e as DomainError).messageAr.length).toBeGreaterThan(0);
    return;
  }
  throw new Error(`expected DomainError ${code}`);
}

const submitted = (suggested: 'C1' | 'C2' | 'C5' = 'C1') => run(INITIAL_FLOW_STATE, { type: 'submit', suggestedCategory: suggested });
/** واقف عند exec بفئة معتمدة */
const atExec = (cat: 'C1' | 'C2' | 'C4' = 'C1') =>
  run(submitted(), { type: 'approve' }, { type: 'setCategory', category: cat });
const ret = (target: string, note = 'برجاء استكمال المرفقات'): FlowCommand => ({ type: 'return', target, reasonIds: ['rr1'], note });

describe('submit', () => {
  it('moves a draft to the first step of the suggested path', () => {
    const r = transition(INITIAL_FLOW_STATE, { type: 'submit', suggestedCategory: 'C2' }, W);
    expect(r.state).toMatchObject({ status: 'active', currentStep: 'sup', suggestedCategory: 'C2', category: null });
    expect(r.logEntry).toMatchObject({ action: 'submit', fromStep: 'company', toStep: 'sup' });
    expect(r.resetsClock).toBe(true);
  });
  it('only from draft', () => {
    expectCode(() => transition(submitted(), { type: 'submit' }, W), 'INVALID_STATE');
  });
});

describe('approve', () => {
  it('advances along the path', () => {
    const s = run(submitted(), { type: 'approve' });
    expect(s.currentStep).toBe('exec');
  });
  it('requires a category at exec', () => {
    const s = run(submitted(), { type: 'approve' });
    expectCode(() => transition(s, { type: 'approve' }, W), 'CATEGORY_REQUIRED');
    expect(run(s, { type: 'setCategory', category: 'C1' }, { type: 'approve' }).currentStep).toBe('gm');
  });
  it('follows the confirmed category path, not the suggested one', () => {
    const s = run(atExec('C2'), { type: 'approve' }, { type: 'approve' }, { type: 'approve' });
    expect(s.currentStep).toBe('plan');
  });
  it('cannot approve when not active, and must pay at the last step', () => {
    const returned = run(atExec(), ret('company'));
    expectCode(() => transition(returned, { type: 'approve' }, W), 'INVALID_STATE');
    const atFinance = run(atExec('C1'), ...Array<FlowCommand>(4).fill({ type: 'approve' }));
    expect(atFinance.currentStep).toBe('finance');
    expectCode(() => transition(atFinance, { type: 'approve' }, W), 'PAY_REQUIRED');
  });
});

describe('setCategory', () => {
  it('logs a category entry without resetting the clock', () => {
    const s = run(submitted(), { type: 'approve' });
    const r = transition(s, { type: 'setCategory', category: 'C3' }, W);
    expect(r.state.category).toBe('C3');
    expect(r.logEntry).toMatchObject({ action: 'category', category: 'C3', fromStep: 'exec', toStep: 'exec' });
    expect(r.resetsClock).toBe(false);
  });
  it('keeps the current step when it exists in the new path', () => {
    const atPlan = run(atExec('C2'), { type: 'approve' }, { type: 'approve' }, { type: 'approve' });
    const s = run(atPlan, { type: 'setCategory', category: 'C4' });
    expect(s).toMatchObject({ category: 'C4', currentStep: 'plan' });
    expect(run(s, { type: 'approve' }).currentStep).toBe('pres');
  });
  it('rejects a category whose path does not contain the current step', () => {
    const atPlan = run(atExec('C2'), { type: 'approve' }, { type: 'approve' }, { type: 'approve' });
    expectCode(() => transition(atPlan, { type: 'setCategory', category: 'C1' }, W), 'STEP_NOT_IN_PATH');
  });
});

describe('return / resubmit', () => {
  const atTech = () => run(atExec('C1'), { type: 'approve' }, { type: 'approve' });

  it('returns to an earlier step, then resubmit goes back to the returning step (not the start)', () => {
    const r = transition(atTech(), ret('exec'), W);
    expect(r.state).toMatchObject({ status: 'returned', returnTo: 'exec', returnedFrom: 'tech' });
    expect(r.logEntry).toMatchObject({ action: 'return', fromStep: 'tech', toStep: 'exec', reasonIds: ['rr1'] });
    const back = transition(r.state, { type: 'resubmit' }, W);
    expect(back.state).toMatchObject({ status: 'active', currentStep: 'tech', returnTo: null, returnedFrom: null });
    expect(back.logEntry).toMatchObject({ action: 'resubmit', fromStep: 'exec', toStep: 'tech' });
  });
  it('returns to the company and resubmit can update the suggested category', () => {
    const s = run(atTech(), ret('company'));
    expect(s.returnTo).toBe('company');
    const back = run(s, { type: 'resubmit', suggestedCategory: 'C2' });
    expect(back).toMatchObject({ currentStep: 'tech', suggestedCategory: 'C2', category: 'C1' });
  });
  it('rejects a later step, the current step or a step outside the path', () => {
    expectCode(() => transition(atTech(), ret('stores'), W), 'INVALID_RETURN_TARGET');
    expectCode(() => transition(atTech(), ret('tech'), W), 'INVALID_RETURN_TARGET');
    expectCode(() => transition(atTech(), ret('plan'), W), 'INVALID_RETURN_TARGET');
  });
  it('requires at least one reason and a note', () => {
    expectCode(() => transition(atTech(), { type: 'return', target: 'company', reasonIds: [], note: 'x' }, W), 'REASON_REQUIRED');
    expectCode(() => transition(atTech(), ret('company', '   '), W), 'NOTE_REQUIRED');
  });
  it('resubmit only when returned', () => {
    expectCode(() => transition(atTech(), { type: 'resubmit' }, W), 'INVALID_STATE');
  });
});

describe('hold / release', () => {
  it('holds at the current step and releases back to it', () => {
    const held = run(atExec(), { type: 'approve' }, { type: 'hold', reason: 'بانتظار اعتماد أمر التكليف' });
    expect(held).toMatchObject({ status: 'on_hold', heldAt: 'gm', holdReason: 'بانتظار اعتماد أمر التكليف' });
    expectCode(() => transition(held, { type: 'approve' }, W), 'INVALID_STATE');
    const r = transition(held, { type: 'release' }, W);
    expect(r.state).toMatchObject({ status: 'active', currentStep: 'gm', heldAt: null, holdReason: null });
    expect(r.logEntry.action).toBe('release');
  });
  it('requires a reason and an active invoice', () => {
    expectCode(() => transition(atExec(), { type: 'hold', reason: '' }, W), 'NOTE_REQUIRED');
    expectCode(() => transition(atExec(), { type: 'release' }, W), 'INVALID_STATE');
  });
});

describe('pay', () => {
  const atFinance = () => run(atExec('C1'), ...Array<FlowCommand>(4).fill({ type: 'approve' }));

  it('pays at the last step with a reference', () => {
    const r = transition(atFinance(), { type: 'pay', ref: 'CHQ-1234' }, W);
    expect(r.state).toMatchObject({ status: 'paid', currentStep: null });
    expect(r.logEntry).toMatchObject({ action: 'pay', fromStep: 'finance', toStep: 'done', ref: 'CHQ-1234' });
  });
  it('requires a reference and the last step', () => {
    expectCode(() => transition(atFinance(), { type: 'pay', ref: ' ' }, W), 'REF_REQUIRED');
    expectCode(() => transition(atExec(), { type: 'pay', ref: 'X' }, W), 'NOT_LAST_STEP');
  });
  it('nothing is allowed after payment', () => {
    const paid = run(atFinance(), { type: 'pay', ref: 'X' });
    expectCode(() => transition(paid, { type: 'approve' }, W), 'INVALID_STATE');
    expectCode(() => transition(paid, ret('company'), W), 'INVALID_STATE');
  });
});

it('full C1 lifecycle with a return to company in the middle', () => {
  const s = run(
    INITIAL_FLOW_STATE,
    { type: 'submit', suggestedCategory: 'C1' },
    { type: 'approve' },
    { type: 'setCategory', category: 'C1' },
    { type: 'approve' },
    ret('company'),
    { type: 'resubmit' },
    { type: 'approve' },
    { type: 'approve' },
    { type: 'approve' },
    { type: 'pay', ref: 'TRF-77' },
  );
  expect(s.status).toBe('paid');
});

it('does not mutate the input state', () => {
  const s = submitted();
  const copy = { ...s };
  transition(s, { type: 'approve' }, W);
  expect(s).toEqual(copy);
});
