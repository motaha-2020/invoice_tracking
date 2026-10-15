import { describe, expect, it } from 'vitest';
import {
  actingRole, canAct, canOverride, canView, DEFAULT_PERMISSIONS, hasPermission, inScope,
  ROLE_DEFAULT_SCOPE, type OrgPath, type RoleScope,
} from './scope';
import { ROLES } from './types';
import { DEFAULT_WORKFLOW as W } from './workflow';

const ORG: OrgPath = { companyId: 'co2', presidencyId: 'pr1', sectorId: 's1', generalDeptId: 'g1', deptId: 'd1', centralId: 'c1' };
const OTHER: OrgPath = { companyId: 'co1', presidencyId: 'pr2', sectorId: 's3', generalDeptId: 'g4', deptId: 'd5', centralId: 'c6' };

const rs = (role: RoleScope['role'], scopeType: RoleScope['scopeType'], scopeId: string | null = null): RoleScope => ({ role, scopeType, scopeId });
const user = (...roleScopes: RoleScope[]) => ({ roleScopes });

describe('inScope', () => {
  it.each([
    [rs('pmo', 'all'), true],
    [rs('company', 'company', 'co2'), true],
    [rs('company', 'company', 'co1'), false],
    [rs('presidency_head', 'presidency', 'pr1'), true],
    [rs('tech_affairs', 'sector', 's1'), true],
    [rs('gm', 'general_dept', 'g1'), true],
    [rs('gm', 'general_dept', 'g2'), false],
    [rs('exec_mgr', 'dept', 'd1'), true],
    [rs('supervisor', 'central', 'c1'), true],
    [rs('supervisor', 'dept', null), false],
  ])('%o → %s', (scope, expected) => expect(inScope([scope], ORG)).toBe(expected));

  it('any of several role scopes is enough', () => {
    expect(inScope([rs('gm', 'general_dept', 'g4'), rs('gm', 'general_dept', 'g1')], ORG)).toBe(true);
    expect(inScope([], ORG)).toBe(false);
  });
});

describe('canAct', () => {
  const active = (step: string) => ({ status: 'active' as const, currentStep: step, returnTo: null });

  it('the role of the current step, within scope', () => {
    expect(canAct(user(rs('exec_mgr', 'dept', 'd1')), active('exec'), ORG, W)).toBe(true);
    expect(canAct(user(rs('exec_mgr', 'dept', 'd1')), active('exec'), OTHER, W)).toBe(false);
    expect(canAct(user(rs('gm', 'general_dept', 'g1')), active('exec'), ORG, W)).toBe(false);
  });
  it('role and scope must come from the same role scope', () => {
    // exec_mgr في d5 + gm في g1: مينفعش يعتمد exec في d1
    expect(canAct(user(rs('exec_mgr', 'dept', 'd5'), rs('gm', 'general_dept', 'g1')), active('exec'), ORG, W)).toBe(false);
  });
  it('returned → the party it was returned to acts', () => {
    const toCompany = { status: 'returned' as const, currentStep: 'tech', returnTo: 'company' };
    const toExec = { status: 'returned' as const, currentStep: 'tech', returnTo: 'exec' };
    expect(canAct(user(rs('company', 'company', 'co2')), toCompany, ORG, W)).toBe(true);
    expect(canAct(user(rs('tech_affairs', 'sector', 's1')), toCompany, ORG, W)).toBe(false);
    expect(canAct(user(rs('exec_mgr', 'dept', 'd1')), toExec, ORG, W)).toBe(true);
    expect(canAct(user(rs('company', 'company', 'co2')), toExec, ORG, W)).toBe(false);
  });
  it('drafts belong to the company; hold and paid belong to nobody', () => {
    const company = user(rs('company', 'company', 'co2'));
    expect(canAct(company, { status: 'draft', currentStep: null, returnTo: null }, ORG, W)).toBe(true);
    expect(canAct(company, { status: 'draft', currentStep: null, returnTo: null }, OTHER, W)).toBe(false);
    expect(canAct(user(rs('pmo', 'all')), { status: 'on_hold', currentStep: 'gm', returnTo: null }, ORG, W)).toBe(false);
    expect(actingRole({ status: 'paid', currentStep: null, returnTo: null }, W)).toBeNull();
  });
});

describe('permissions', () => {
  it('canOverride for pmo/admin only', () => {
    expect(canOverride([rs('pmo', 'all')])).toBe(true);
    expect(canOverride([rs('admin', 'all')])).toBe(true);
    expect(canOverride([rs('gm', 'general_dept', 'g1')])).toBe(false);
  });
  it('includes issues.import and deductions.edit', () => {
    expect(hasPermission([rs('stores', 'sector', 's1')], 'issues.import')).toBe(true);
    expect(hasPermission([rs('finance', 'all')], 'deductions.edit')).toBe(true);
    expect(hasPermission([rs('company', 'company', 'co2')], 'deductions.edit')).toBe(false);
    expect(DEFAULT_PERMISSIONS['invoice.create']).toEqual(['company']);
  });
  it('every role has a default scope', () => {
    for (const r of ROLES) expect(ROLE_DEFAULT_SCOPE[r]).toBeDefined();
    expect(ROLE_DEFAULT_SCOPE.gm).toBe('general_dept');
  });
});

describe('canView', () => {
  it('drafts are visible only to their company', () => {
    expect(canView(user(rs('pmo', 'all')), { status: 'draft' }, ORG)).toBe(false);
    expect(canView(user(rs('company', 'company', 'co2')), { status: 'draft' }, ORG)).toBe(true);
    expect(canView(user(rs('pmo', 'all')), { status: 'active' }, ORG)).toBe(true);
    expect(canView(user(rs('gm', 'general_dept', 'g4')), { status: 'active' }, ORG)).toBe(false);
  });
});
