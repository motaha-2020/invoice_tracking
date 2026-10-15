import type { Role, ScopeType } from "@it/db";

/** دور + نطاق (صف من user_roles) */
export type RoleScope = {
  role: Role;
  scopeType: ScopeType;
  /** id الكيان — null لـ all */
  scopeId: string | null;
};

/** المستخدم الحالي زي ما الصفحات والـ services بتشوفه — من غير أي بيانات حساسة */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  roles: RoleScope[];
};
