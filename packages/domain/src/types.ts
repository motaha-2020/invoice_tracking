/*
 * أنواع مطابقة للـ enums في packages/db/prisma/schema.prisma.
 * متكررة هنا عمداً عشان @it/domain ما يعتمدش على Prisma. لو enum اتغير هناك، يتغير هنا.
 */

export type Role =
  | 'admin'
  | 'pmo'
  | 'company'
  | 'supervisor'
  | 'exec_mgr'
  | 'gm'
  | 'tech_affairs'
  | 'tech_office'
  | 'planning'
  | 'sector_head'
  | 'presidency_head'
  | 'committee'
  | 'stores'
  | 'finance';

export const ROLES: readonly Role[] = [
  'admin', 'pmo', 'company', 'supervisor', 'exec_mgr', 'gm', 'tech_affairs',
  'tech_office', 'planning', 'sector_head', 'presidency_head', 'committee', 'stores', 'finance',
];

export type ScopeType = 'all' | 'company' | 'presidency' | 'sector' | 'general_dept' | 'dept' | 'central';

export type InvoiceStatus = 'draft' | 'active' | 'returned' | 'on_hold' | 'paid';

export type StepAction =
  | 'submit'
  | 'approve'
  | 'return'
  | 'resubmit'
  | 'category'
  | 'qty'
  | 'hold'
  | 'release'
  | 'pay'
  | 'deductions'
  | 'retention';

export type DeductionType = 'asbuilt' | 'handover' | 'tax' | 'penalty' | 'other';

/** لون الحالة في الواجهة: g أخضر، a أصفر، r أحمر، n محايد، b أزرق */
export type StatusColor = 'g' | 'a' | 'r' | 'n' | 'b';
