import type { InvoiceStatus, Role, ScopeType } from './types';
import type { ReturnTarget } from './transition';
import type { StepKey, WorkflowConfig } from './workflow';

/*
 * النطاق والصلاحيات. نفس المنطق ده لازم يتطابق مع scopeWhere(user) اللي بتبني Prisma where.
 * المستخدم ممكن يبقى عنده أكتر من (دور + نطاق) — user_role_scopes.
 */

/** مكان المستخلص في الهيكل (من أمر التكليف ← المشروع ← السنترال ← ...). */
export interface OrgPath {
  companyId: string;
  presidencyId: string;
  sectorId: string;
  generalDeptId: string;
  deptId: string;
  centralId: string;
}

export interface RoleScope {
  role: Role;
  scopeType: ScopeType;
  /** null مع scopeType = 'all' */
  scopeId: string | null;
}

const SCOPE_FIELD: Record<Exclude<ScopeType, 'all'>, keyof OrgPath> = {
  company: 'companyId',
  presidency: 'presidencyId',
  sector: 'sectorId',
  general_dept: 'generalDeptId',
  dept: 'deptId',
  central: 'centralId',
};

/** النطاق الافتراضي لكل دور (لما الـ admin يضيف مستخدم). */
export const ROLE_DEFAULT_SCOPE: Readonly<Record<Role, ScopeType>> = {
  admin: 'all',
  pmo: 'all',
  company: 'company',
  supervisor: 'dept',
  exec_mgr: 'dept',
  gm: 'general_dept',
  tech_affairs: 'sector',
  tech_office: 'sector',
  planning: 'all',
  sector_head: 'sector',
  presidency_head: 'presidency',
  committee: 'all',
  stores: 'sector',
  finance: 'all',
};

export type Permission =
  | 'invoice.create'
  | 'invoice.viewAll'
  | 'invoice.override'
  | 'master.import'
  | 'issues.import'
  | 'users.manage'
  | 'workflow.config'
  | 'reports.view'
  | 'reports.export'
  | 'deductions.edit';

/** صلاحيات إضافية لكل دور (غير الاعتماد في محطته). */
export const DEFAULT_PERMISSIONS: Readonly<Record<Permission, readonly Role[]>> = {
  'invoice.create': ['company'],
  'invoice.viewAll': ['admin', 'pmo'],
  'invoice.override': ['admin', 'pmo'],
  'master.import': ['admin', 'tech_affairs'],
  'issues.import': ['admin', 'stores'],
  'users.manage': ['admin'],
  'workflow.config': ['admin', 'pmo'],
  'reports.view': [
    'admin', 'pmo', 'exec_mgr', 'gm', 'tech_affairs', 'tech_office', 'planning',
    'sector_head', 'presidency_head', 'stores', 'finance', 'company',
  ],
  'reports.export': ['admin', 'pmo', 'gm', 'tech_affairs', 'sector_head', 'presidency_head', 'finance', 'company'],
  'deductions.edit': ['finance', 'admin'],
};

/** هل (دور + نطاق) واحد بيغطي المكان ده؟ */
export function scopeCovers(rs: RoleScope, org: OrgPath): boolean {
  if (rs.scopeType === 'all') return true;
  return rs.scopeId != null && org[SCOPE_FIELD[rs.scopeType]] === rs.scopeId;
}

/** هل المكان ده جوه أي نطاق من نطاقات المستخدم؟ */
export function inScope(roleScopes: readonly RoleScope[], org: OrgPath): boolean {
  return roleScopes.some((rs) => scopeCovers(rs, org));
}

/** هل المستخدم عنده الدور ده بنطاق بيغطي المكان؟ */
export function hasRoleIn(roleScopes: readonly RoleScope[], role: Role, org: OrgPath): boolean {
  return roleScopes.some((rs) => rs.role === role && scopeCovers(rs, org));
}

/** هل أي دور من أدوار المستخدم عنده الصلاحية؟ */
export function hasPermission(
  roleScopes: readonly RoleScope[],
  permission: Permission,
  permissions: Readonly<Record<Permission, readonly Role[]>> = DEFAULT_PERMISSIONS,
): boolean {
  const allowed = permissions[permission];
  return roleScopes.some((rs) => allowed.includes(rs.role));
}

/** PMO / Admin: يقدروا يحرّكوا أي محطة بدل الإدارة. */
export function canOverride(roleScopes: readonly RoleScope[]): boolean {
  return hasPermission(roleScopes, 'invoice.override');
}

export interface ActableInvoice {
  status: InvoiceStatus;
  currentStep: StepKey | null;
  returnTo: ReturnTarget | null;
}

/** مين عليه الدور دلوقتي: 'company' أو دور المحطة، أو null (معلّق / مصروف). */
export function actingRole(inv: ActableInvoice, config: WorkflowConfig): Role | null {
  if (inv.status === 'draft') return 'company';
  if (inv.status === 'returned') {
    if (!inv.returnTo || inv.returnTo === 'company') return 'company';
    return config.steps[inv.returnTo]?.role ?? null;
  }
  if (inv.status !== 'active' || !inv.currentStep) return null;
  return config.steps[inv.currentStep]?.role ?? null;
}

/** هل المستخدم ده هو اللي عليه الدور في المستخلص؟ (المرتجع ← الجهة اللي اترجع لها) */
export function canAct(
  user: { roleScopes: readonly RoleScope[] },
  inv: ActableInvoice,
  org: OrgPath,
  config: WorkflowConfig,
): boolean {
  const role = actingRole(inv, config);
  return role != null && hasRoleIn(user.roleScopes, role, org);
}

/** يشوف المستخلص؟ جوه نطاقه، والمسودات للشركة صاحبتها بس. */
export function canView(user: { roleScopes: readonly RoleScope[] }, inv: { status: InvoiceStatus }, org: OrgPath): boolean {
  if (inv.status === 'draft') return hasRoleIn(user.roleScopes, 'company', org);
  return inScope(user.roleScopes, org);
}
