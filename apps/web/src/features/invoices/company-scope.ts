import type { SessionUser } from "@/features/auth/auth.types";

/** شركات المستخدم (نطاقات دور المقاول) */
export function companyIdsOf(user: SessionUser): string[] {
  return [...new Set(user.roles.filter((r) => r.role === "company" && r.scopeType === "company" && r.scopeId).map((r) => r.scopeId!))];
}
