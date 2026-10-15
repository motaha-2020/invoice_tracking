/** نصوص شاشة المستخدمين — client-safe (من غير server-only) */
import type { ScopeType } from "@it/db";
import type { Permission } from "../auth/permission-rules";

/** وصف كل صلاحية بالعربي (من الديمو) */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "invoice.create": "تقديم مستخلص جديد على البوابة",
  "invoice.viewAll": "يشوف كل المستخلصات من غير قيود النطاق",
  "invoice.override": "يحرّك المستخلص بدل أي محطة (تجاوز إداري)",
  "master.import": "رفع العقود والمقايسات وأوامر التكليف والملاحق",
  "issues.import": "رفع كتالوج المهمات والمنصرف من المخازن",
  "users.manage": "إضافة المستخدمين وتعديل الأدوار والصلاحيات",
  "workflow.config": "تعديل المسار والـ SLA وأسباب الإرجاع والإعدادات",
  "reports.view": "فتح شاشة التقارير",
  "reports.export": "تصدير التقارير Excel",
  "deductions.edit": "تعديل الاستقطاعات والضمانات",
};

/** النطاق يعني إيه — "مين يشوف إيه" */
export const SCOPE_EXPLAIN: Record<ScopeType, string> = {
  all: "بيشوف كل المستخلصات في كل الجهات.",
  company: "بيشوف مستخلصات شركته بس — ومسوداتها كمان.",
  presidency: "كل القطاعات والإدارات والسنترالات اللي تحت رئاسة القطاعات بتاعته.",
  sector: "كل الإدارات العامة والمختصة والسنترالات اللي في قطاعه.",
  general_dept: "الإدارات المختصة والسنترالات اللي تحت إدارته العامة.",
  dept: "السنترالات والمشروعات اللي في إدارته المختصة بس.",
  central: "مشروعات سنترال واحد بس.",
};
