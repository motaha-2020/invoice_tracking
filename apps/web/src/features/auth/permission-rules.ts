/**
 * الصلاحيات الإضافية لكل دور (غير الاعتماد في محطته) — دوال صافية.
 * المصدر الأساسي جدول role_permissions، والـ DEFAULT_PERMISSIONS دي fallback لو الجدول لسه فاضي.
 * TODO(@it/domain): تتنقل لـ packages/domain مع منطق الصلاحيات.
 */
import type { Role } from "@it/db";

export const DEFAULT_PERMISSIONS = {
  "invoice.create": ["company"],
  "invoice.viewAll": ["admin", "pmo"],
  "invoice.override": ["admin", "pmo"],
  "master.import": ["admin", "tech_affairs"],
  "org.manage": ["admin", "pmo", "tech_affairs"],
  "issues.import": ["admin", "stores"],
  "users.manage": ["admin"],
  "workflow.config": ["admin", "pmo"],
  "reports.view": [
    "admin", "pmo", "exec_mgr", "gm", "tech_affairs", "tech_office", "planning",
    "sector_head", "presidency_head", "stores", "finance", "company",
  ],
  "reports.export": ["admin", "pmo", "gm", "tech_affairs", "sector_head", "presidency_head", "finance", "company"],
  "deductions.edit": ["finance", "admin"],
  "retentions.release": ["finance", "admin"],
  "contracts.edit": ["tech_affairs", "admin"],
  /** تعديل وحذف السجلات (العقود، أوامر التكليف، البنود، المستخلصات، الهيكل) — مدير النظام فقط */
  "records.manage": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof DEFAULT_PERMISSIONS;

export type PermissionRow = { role: Role; permission: string };

/**
 * هل أي دور من أدوار المستخدم ليه الصلاحية؟
 * rows = صفوف role_permissions؛ لو الجدول فاضي (null أو []) بنرجع للـ defaults.
 */
export function hasPermission(roles: readonly Role[], perm: Permission, rows: readonly PermissionRow[] | null): boolean {
  if (rows && rows.length > 0) {
    return rows.some((r) => r.permission === perm && roles.includes(r.role));
  }
  const allowed: readonly Role[] = DEFAULT_PERMISSIONS[perm];
  return roles.some((r) => allowed.includes(r));
}
