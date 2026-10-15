import "server-only";
import { cache } from "react";
import { listRolePermissions } from "./auth.repo";
import type { SessionUser } from "./auth.types";
import { hasPermission, type Permission } from "./permission-rules";

export type { Permission } from "./permission-rules";

/** صفوف role_permissions — مرة واحدة لكل request (جدول صغير) */
const loadPermissionRows = cache(listRolePermissions);

/** هل المستخدم ليه الصلاحية؟ الجدول الأول، ولو فاضي الـ defaults (permission-rules.ts) */
export async function can(user: SessionUser, perm: Permission): Promise<boolean> {
  const rows = await loadPermissionRows();
  return hasPermission(
    user.roles.map((r) => r.role),
    perm,
    rows,
  );
}
