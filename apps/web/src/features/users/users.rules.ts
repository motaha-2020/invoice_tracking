/**
 * قواعد المستخدمين والأدوار والصلاحيات — دوال صافية (من غير DB ولا Next) عشان تتختبر بـ vitest.
 */
import type { Role, ScopeType } from "@it/db";
import { ROLES, ROLE_DEFAULT_SCOPE } from "@it/domain";
import { DEFAULT_PERMISSIONS, type Permission, type PermissionRow } from "../auth/permission-rules";

export const ALL_ROLES = ROLES as readonly Role[];

export const SCOPE_TYPES: readonly ScopeType[] = ["all", "company", "presidency", "sector", "general_dept", "dept", "central"];

/** نوع نطاق ليه كيان (كل الأنواع غير all) */
export type EntityScopeType = Exclude<ScopeType, "all">;

export type RoleScopeInput = { role: Role; scopeType: ScopeType; scopeId: string | null };

type Result<T> = { value: T; error?: undefined } | { value?: undefined; error: string };

/** النطاق المعتاد للدور (من @it/domain) — الواجهة بتبدأ بيه والأدمن يقدر يغيّره */
export function defaultScopeType(role: Role): ScopeType {
  return ROLE_DEFAULT_SCOPE[role] as ScopeType;
}

export function parseRole(v: unknown): Role | null {
  const t = String(v ?? "").trim().toLowerCase();
  return (ALL_ROLES as readonly string[]).includes(t) ? (t as Role) : null;
}

/** أسماء بديلة لنوع النطاق — القالب بيكتب gdept، والناس ممكن تكتب بالعربي */
const SCOPE_ALIASES: Record<string, ScopeType> = {
  gdept: "general_dept",
  "general-dept": "general_dept",
  generaldept: "general_dept",
  "كل الجهات": "all",
  الكل: "all",
  شركة: "company",
  "رئاسة قطاعات": "presidency",
  رئاسة: "presidency",
  قطاع: "sector",
  "إدارة عامة": "general_dept",
  "ادارة عامة": "general_dept",
  إدارة: "dept",
  ادارة: "dept",
  "إدارة مختصة": "dept",
  سنترال: "central",
};

export function parseScopeType(v: unknown): ScopeType | null {
  const t = String(v ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const low = t.toLowerCase();
  if ((SCOPE_TYPES as readonly string[]).includes(low)) return low as ScopeType;
  return SCOPE_ALIASES[low] ?? SCOPE_ALIASES[t] ?? null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normalizeEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();
export const isEmail = (v: string) => EMAIL_RE.test(v) && v.length <= 200;

export function roleScopeKey(rs: RoleScopeInput): string {
  return `${rs.role}|${rs.scopeType}|${rs.scopeType === "all" ? "" : (rs.scopeId ?? "")}`;
}

/**
 * تنضيف صفوف الدور+النطاق اللي جاية من الفورم: all مالوش كيان، وغيره لازم كيان،
 * والتكرار بيتشال. knownIds (اختياري) = الكيانات الموجودة فعلاً لكل نوع.
 */
export function normalizeRoleScopes(
  list: readonly RoleScopeInput[],
  knownIds?: Partial<Record<EntityScopeType, ReadonlySet<string>>>,
): Result<RoleScopeInput[]> {
  if (list.length === 0) return { error: "لازم دور واحد على الأقل" };
  const out: RoleScopeInput[] = [];
  const seen = new Set<string>();
  for (const rs of list) {
    if (!parseRole(rs.role)) return { error: `دور مش معروف: ${rs.role}` };
    if (!(SCOPE_TYPES as readonly string[]).includes(rs.scopeType)) return { error: `نوع نطاق مش معروف: ${rs.scopeType}` };
    const clean: RoleScopeInput =
      rs.scopeType === "all" ? { role: rs.role, scopeType: "all", scopeId: null } : { role: rs.role, scopeType: rs.scopeType, scopeId: rs.scopeId || null };
    if (clean.scopeType !== "all") {
      if (!clean.scopeId) return { error: "اختار الجهة لكل دور نطاقه مش \"كل الجهات\"" };
      const known = knownIds?.[clean.scopeType];
      if (known && !known.has(clean.scopeId)) return { error: "الجهة المختارة مش موجودة — حدّث الصفحة" };
    }
    const k = roleScopeKey(clean);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(clean);
  }
  return { value: out };
}

// ── كود الجهة ← id (للاستيراد) ─────────────────────────

export type ScopeEntity = { id: string; code: string; name: string };
/** لكل نوع نطاق: الكود (متوحّد upper) ← الكيان */
export type ScopeLookup = Record<EntityScopeType, ReadonlyMap<string, ScopeEntity>>;

export const ENTITY_SCOPE_TYPES = SCOPE_TYPES.filter((t): t is EntityScopeType => t !== "all");

export function buildScopeLookup(lists: Record<EntityScopeType, readonly ScopeEntity[]>): ScopeLookup {
  const out = {} as Record<EntityScopeType, Map<string, ScopeEntity>>;
  for (const t of ENTITY_SCOPE_TYPES) out[t] = new Map(lists[t].map((e) => [e.code.toUpperCase(), e]));
  return out;
}

/** بيحوّل كود الجهة لكيان حسب نوع النطاق. all ← null (من غير كود). */
export function resolveScopeCode(lookup: ScopeLookup, scopeType: ScopeType, code: string): Result<ScopeEntity | null> {
  const c = code.replace(/\s+/g, "").toUpperCase();
  if (scopeType === "all") return { value: null };
  if (!c) return { error: "كود النطاق إلزامي لما النطاق مش \"كل الجهات\"" };
  const hit = lookup[scopeType].get(c);
  return hit ? { value: hit } : { error: `الكود "${code}" مش موجود في ${SCOPE_TYPE_NAMES[scopeType]} — ارفع الهيكل/الشركات الأول` };
}

const SCOPE_TYPE_NAMES: Record<EntityScopeType, string> = {
  company: "الشركات",
  presidency: "رئاسات القطاعات",
  sector: "القطاعات",
  general_dept: "الإدارات العامة",
  dept: "الإدارات المختصة",
  central: "السنترالات",
};

/** صف مستخدم سليم من قالب 04 — كل صف = دور+نطاق واحد */
export type ImportUserRow = RoleScopeInput & { email: string; name: string; phone: string | null };

export type ImportUserGroup = { email: string; name: string; phone: string | null; roles: RoleScopeInput[] };

/** نفس الإيميل في أكتر من صف = مستخدم واحد بأكتر من نطاق. الاسم/الموبايل من أول صف فيه قيمة. */
export function groupImportRows(rows: readonly ImportUserRow[]): ImportUserGroup[] {
  const groups = new Map<string, ImportUserGroup & { keys: Set<string> }>();
  for (const r of rows) {
    let g = groups.get(r.email);
    if (!g) {
      g = { email: r.email, name: r.name, phone: r.phone, roles: [], keys: new Set() };
      groups.set(r.email, g);
    }
    if (!g.phone && r.phone) g.phone = r.phone;
    const rs: RoleScopeInput = { role: r.role, scopeType: r.scopeType, scopeId: r.scopeType === "all" ? null : r.scopeId };
    const k = roleScopeKey(rs);
    if (!g.keys.has(k)) {
      g.keys.add(k);
      g.roles.push(rs);
    }
  }
  return [...groups.values()].map((g) => ({ email: g.email, name: g.name, phone: g.phone, roles: g.roles }));
}

// ── الصلاحيات ───────────────────────────────────────────

export const PERMISSION_KEYS = Object.keys(DEFAULT_PERMISSIONS) as Permission[];

export function isPermission(v: unknown): v is Permission {
  return typeof v === "string" && (PERMISSION_KEYS as string[]).includes(v);
}

/** مصفوفة الصلاحيات الفعلية: الجدول، ولو فاضي الـ defaults (نفس قاعدة hasPermission) */
export function effectiveMatrix(rows: readonly PermissionRow[]): Record<Permission, Role[]> {
  const out = {} as Record<Permission, Role[]>;
  for (const p of PERMISSION_KEYS) {
    out[p] = rows.length > 0 ? rows.filter((r) => r.permission === p).map((r) => r.role) : [...DEFAULT_PERMISSIONS[p]];
  }
  return out;
}

export type PermissionPlan = {
  /** صفوف لازم تتكتب الأول لو الجدول فاضي (عشان التعديل ما يلغيش باقي الـ defaults) */
  seed: PermissionRow[];
  add?: PermissionRow;
  remove?: PermissionRow;
};

/** بيخطط تعديل خانة في المصفوفة. القاعدة: مدير النظام دايماً معاه users.manage (ما يقفلش على نفسه). */
export function planPermissionToggle(rows: readonly PermissionRow[], perm: Permission, role: Role, on: boolean): Result<PermissionPlan> {
  if (!on && perm === "users.manage" && role === "admin") {
    return { error: "مينفعش تشيل إدارة المستخدمين من مدير النظام — هيتقفل على الكل" };
  }
  const seed: PermissionRow[] =
    rows.length > 0 ? [] : PERMISSION_KEYS.flatMap((p) => DEFAULT_PERMISSIONS[p].map((r) => ({ role: r as Role, permission: p })));
  const current = rows.length > 0 ? rows : seed;
  const has = current.some((r) => r.role === role && r.permission === perm);
  const row = { role, permission: perm };
  if (on) return { value: has ? { seed } : { seed, add: row } };
  return { value: has ? { seed, remove: row } : { seed } };
}

/** هل الأدوار دي هيفضل معاها إدارة المستخدمين؟ (حماية الأدمن من إنه يقفل على نفسه وهو بيعدّل حسابه) */
export function keepsUsersManage(roles: readonly Role[], rows: readonly PermissionRow[]): boolean {
  const allowed = effectiveMatrix(rows)["users.manage"];
  return roles.some((r) => allowed.includes(r));
}
