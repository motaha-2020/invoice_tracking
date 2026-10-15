import type { Role, ScopeType } from "@it/db";
import type { EntityScopeType } from "./users.rules";

/** صف دور+نطاق للعرض */
export type UserRoleView = { role: Role; scopeType: ScopeType; scopeId: string | null; scopeName: string };

/** صف مستخدم في الجدول — من غير أي بيانات حساسة (مفيش hash) */
export type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  active: boolean;
  /** حدّد كلمة السر (قبل الدعوة = false) */
  hasPassword: boolean;
  /** فيه دعوة لسه صالحة ما اتستخدمتش */
  invitePending: boolean;
  lastLoginAt: string | null;
  roles: UserRoleView[];
};

export type ScopeOption = { id: string; code: string; name: string };
export type ScopeOptions = Record<EntityScopeType, ScopeOption[]>;

export type UserFilter = { q?: string; role?: Role; active?: "1" | "0" };

export type UserPick = { id: string; name: string; email: string };

export type DelegationRow = {
  id: string;
  fromUser: UserPick;
  toUser: UserPick;
  startsOn: string;
  endsOn: string;
  note: string | null;
};

export type InviteLink = { userId: string; name: string; email: string; link: string };
