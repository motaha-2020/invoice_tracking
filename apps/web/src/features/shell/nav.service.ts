import "server-only";
import { forbidden } from "next/navigation";
import { cache } from "react";
import type { SessionUser } from "@/features/auth/auth.types";
import { can } from "@/features/auth/permissions";
import type { Permission } from "@/features/auth/permission-rules";
import { requireUser } from "@/features/auth/session";
import { NAV, findNavItem, navAllowed, type AllowedNavSection } from "./nav";

/** القائمة متفلترة حسب أدوار وصلاحيات المستخدم */
export const getAllowedNav = cache(async (user: SessionUser): Promise<AllowedNavSection[]> => {
  const perms = new Set(NAV.flatMap((s) => s.items).map((i) => i.perm).filter((p): p is Permission => !!p));
  const granted = new Set<Permission>();
  await Promise.all(
    [...perms].map(async (p) => {
      if (await can(user, p)) granted.add(p);
    }),
  );
  const roles = user.roles.map((r) => r.role);
  return NAV.map((s) => ({ title: s.title, items: s.items.filter((i) => navAllowed(i, roles, (p) => granted.has(p))) })).filter(
    (s) => s.items.length > 0,
  );
});

/**
 * الصفحة نفسها بتتحقق بنفس قاعدة القائمة — مش بس إخفاء اللينك.
 * أكتر من key = مسموح لو أي واحد منهم مسموح (زي /inbox: "صندوق الوارد" و"مطلوب الرد").
 */
export async function requireNavAccess(...keys: string[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!keys.every((k) => findNavItem(k))) throw new Error(`nav key مش معروف: ${keys.join(",")}`);
  const nav = await getAllowedNav(user);
  if (!nav.some((s) => s.items.some((i) => keys.includes(i.key)))) forbidden();
  return user;
}
