/**
 * أنواع كيانات "الهيكل والمشاريع" وأسماؤها — دوال وثوابت صافية (client-safe).
 * الهيكل: رئاسة ← قطاع ← (شئون فنية + إدارة عامة) ← إدارة مختصة ← سنترال ← مشروع.
 */

export const ORG_LEVELS = ["presidency", "sector", "techUnit", "generalDept", "dept", "central"] as const;
export type OrgLevel = (typeof ORG_LEVELS)[number];

export const ORG_KINDS = [...ORG_LEVELS, "projectType", "workType", "project", "company"] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

/** fem = مؤنث (عشان "تحته" / "تحتها" في الرسايل) */
type KindInfo = { one: string; many: string; fem: boolean };

export const KIND_LABELS: Record<OrgKind, KindInfo> = {
  presidency: { one: "رئاسة قطاعات", many: "رئاسات القطاعات", fem: true },
  sector: { one: "قطاع", many: "القطاعات", fem: false },
  techUnit: { one: "شئون فنية", many: "الشئون الفنية", fem: true },
  generalDept: { one: "إدارة عامة", many: "الإدارات العامة", fem: true },
  dept: { one: "إدارة مختصة", many: "الإدارات المختصة", fem: true },
  central: { one: "سنترال", many: "السنترالات", fem: false },
  projectType: { one: "نوع مشروع", many: "أنواع المشروعات", fem: false },
  workType: { one: "نوع أعمال", many: "أنواع الأعمال", fem: false },
  project: { one: "مشروع", many: "المشروعات", fem: false },
  company: { one: "شركة", many: "الشركات", fem: true },
};

/** المستوى الأب لكل مستوى في الهيكل (والـ رئاسة مالهاش أب) */
export const PARENT_LEVEL: Record<OrgLevel, OrgLevel | null> = {
  presidency: null,
  sector: "presidency",
  techUnit: "sector",
  generalDept: "sector",
  dept: "generalDept",
  central: "dept",
};

/** المستويات اللي تحت كل مستوى (لعرض الأبناء وزرار "إضافة") */
export const CHILD_LEVELS: Record<OrgLevel, OrgLevel[]> = {
  presidency: ["sector"],
  sector: ["techUnit", "generalDept"],
  techUnit: [],
  generalDept: ["dept"],
  dept: ["central"],
  central: [],
};

/** اسم حقل الأب في الفورم/الـ schema لكل مستوى */
export const PARENT_FIELD: Record<OrgLevel, string | null> = {
  presidency: null,
  sector: "presidencyId",
  techUnit: "sectorId",
  generalDept: "sectorId",
  dept: "generalDeptId",
  central: "deptId",
};

export function isOrgKind(v: unknown): v is OrgKind {
  return typeof v === "string" && (ORG_KINDS as readonly string[]).includes(v);
}

export function isOrgLevel(v: unknown): v is OrgLevel {
  return typeof v === "string" && (ORG_LEVELS as readonly string[]).includes(v);
}

/** رسالة منع المسح: "مينفعش تمسح قطاع «الشرقية» لأن تحته بيانات: 2 إدارة عامة، 1 مستخدم على النطاق…" */
export function dependentsMessage(kind: OrgKind, name: string, deps: { label: string; n: number }[]): string | null {
  const present = deps.filter((d) => d.n > 0);
  if (!present.length) return null;
  const list = present.map((d) => `${d.n} ${d.label}`).join("، ");
  const { one, fem } = KIND_LABELS[kind];
  return `مينفعش تمسح ${one} «${name}» لأن ${fem ? "تحتها" : "تحته"} بيانات: ${list}. انقلها أو امسحها الأول.`;
}
