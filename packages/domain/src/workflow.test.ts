import { describe, expect, it } from 'vitest';
import { DomainError } from './errors';
import {
  DEFAULT_WORKFLOW as W, effectiveCategory, nextStep, pathFor, previousSteps, slaDaysFor, stepDef, totalSlaDays,
} from './workflow';

const steps = (cat: Parameters<typeof pathFor>[1]) => pathFor(W, cat).map((s) => s.step);

describe('DEFAULT_WORKFLOW', () => {
  it('matches the demo paths', () => {
    expect(steps('C1')).toEqual(['sup', 'exec', 'gm', 'tech', 'stores', 'finance']);
    expect(steps('C2')).toEqual(['sup', 'exec', 'gm', 'tech', 'plan', 'stores', 'finance']);
    expect(steps('C3')).toEqual(['sup', 'exec', 'gm', 'tech', 'plan', 'sector', 'stores', 'finance']);
    expect(steps('C4')).toEqual(['sup', 'exec', 'gm', 'tech', 'plan', 'pres', 'committee', 'sector', 'stores', 'finance']);
    expect(steps('C5')).toEqual(['sup', 'exec', 'gm', 'tech', 'plan', 'pricing', 'pres', 'committee', 'sector', 'stores', 'finance']);
  });
  it('every path starts at sup without SLA and ends at finance', () => {
    for (const cat of ['C1', 'C2', 'C3', 'C4', 'C5'] as const) {
      const path = pathFor(W, cat);
      expect(path[0]).toEqual({ step: 'sup', slaDays: null });
      expect(path.at(-1)?.step).toBe('finance');
      for (const s of path) expect(W.steps[s.step]).toBeDefined();
    }
  });
  it('SLA values and totals', () => {
    expect(slaDaysFor(W, 'C1', 'exec')).toBe(2);
    expect(slaDaysFor(W, 'C2', 'exec')).toBe(1);
    expect(slaDaysFor(W, 'C5', 'pricing')).toBe(10);
    expect(slaDaysFor(W, 'C1', 'plan')).toBeNull();
    expect(totalSlaDays(W, 'C1')).toBe(10);
    expect(totalSlaDays(W, 'C4')).toBe(23);
  });
});

describe('path helpers', () => {
  it('nextStep', () => {
    expect(nextStep(W, 'C1', 'tech')).toBe('stores');
    expect(nextStep(W, 'C2', 'tech')).toBe('plan');
    expect(nextStep(W, 'C1', 'finance')).toBeNull();
    expect(() => nextStep(W, 'C1', 'plan')).toThrow(DomainError);
  });
  it('previousSteps', () => {
    expect(previousSteps(W, 'C1', 'sup')).toEqual([]);
    expect(previousSteps(W, 'C1', 'tech')).toEqual(['sup', 'exec', 'gm']);
  });
  it('stepDef / pathFor reject unknown keys', () => {
    expect(stepDef(W, 'gm').role).toBe('gm');
    expect(() => stepDef(W, 'nope')).toThrow(DomainError);
    expect(() => pathFor(W, 'C9' as 'C1')).toThrow(DomainError);
  });
  it('effectiveCategory prefers confirmed, then suggested, then C1', () => {
    expect(effectiveCategory({ category: 'C3', suggestedCategory: 'C2' })).toBe('C3');
    expect(effectiveCategory({ category: null, suggestedCategory: 'C2' })).toBe('C2');
    expect(effectiveCategory({ category: null })).toBe('C1');
  });
});
