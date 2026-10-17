import type { Role } from "@it/db";
import type { Permission } from "@/features/auth/permission-rules";

/**
 * القائمة الجانبية (من الديمو). icon = اسم في nav-icons.tsx (لأن الـ components ما تعدّيش لـ client كـ props).
 * roles / perm: الاتنين لو موجودين لازم يتحققوا.
 */
export type NavIconName =
  | "home"
  | "inbox"
  | "reply"
  | "file-plus"
  | "files"
  | "reports"
  | "dashboard"
  | "mail"
  | "contracts"
  | "org"
  | "package"
  | "users"
  | "workflow"
  | "banknote";

export type NavItem = {
  key: string;
  href: string;
  label: string;
  icon: NavIconName;
  roles?: readonly Role[];
  perm?: Permission;
  /** بيعرض عدد صندوق الوارد */
  showInboxCount?: boolean;
};

export type NavSection = { title: string; items: readonly NavItem[] };

const REVIEWERS: readonly Role[] = [
  "supervisor", "exec_mgr", "gm", "tech_affairs", "tech_office", "planning", "sector_head",
  "presidency_head", "committee", "stores", "finance", "pmo", "admin",
];

export const NAV: readonly NavSection[] = [
  {
    title: "المهام اليومية",
    items: [
      { key: "home", href: "/", label: "الرئيسية", icon: "home" },
      { key: "inbox", href: "/inbox", label: "المهام الواردة", icon: "inbox", roles: REVIEWERS, showInboxCount: true },
      { key: "co-returned", href: "/inbox", label: "بانتظار استيفاء الملاحظات", icon: "reply", roles: ["company"], showInboxCount: true },
      { key: "inv-new", href: "/invoices/new", label: "مستخلص جديد", icon: "file-plus", perm: "invoice.create" },
      { key: "invoices", href: "/invoices", label: "جميع المستخلصات", icon: "files" },
    ],
  },
  {
    title: "المتابعة والتقارير",
    items: [
      { key: "dashboard", href: "/dashboard", label: "لوحة المؤشرات", icon: "dashboard", perm: "reports.view" },
      {
        key: "retentions",
        href: "/retentions",
        label: "المبالغ المحتجزة",
        icon: "banknote",
        roles: ["finance", "pmo", "admin", "tech_affairs", "company"],
      },
      { key: "reports", href: "/reports", label: "التقارير والتصدير", icon: "reports", perm: "reports.view" },
      { key: "emails", href: "/emails", label: "سجل البريد الإلكتروني", icon: "mail", roles: ["pmo", "admin"] },
    ],
  },
  {
    title: "البيانات الأساسية",
    items: [
      {
        key: "contracts",
        href: "/contracts",
        label: "العقود وأوامر التكليف",
        icon: "contracts",
        roles: ["tech_affairs", "tech_office", "pmo", "admin", "planning", "company"],
      },
      { key: "org", href: "/org", label: "الهيكل التنظيمي والمشروعات", icon: "org", roles: ["admin", "pmo", "tech_affairs", "tech_office"] },
      { key: "materials", href: "/materials", label: "المهمات المنصرفة", icon: "package", roles: ["stores", "pmo", "admin", "tech_affairs"] },
    ],
  },
  {
    title: "الإعدادات",
    items: [
      { key: "users", href: "/users", label: "المستخدمون والصلاحيات", icon: "users", perm: "users.manage" },
      { key: "workflow", href: "/workflow", label: "مسار الاعتماد والمدد المستهدفة", icon: "workflow", perm: "workflow.config" },
    ],
  },
];

export const NAV_ITEMS: readonly NavItem[] = NAV.flatMap((s) => s.items);

export function findNavItem(key: string): NavItem | undefined {
  return NAV_ITEMS.find((i) => i.key === key);
}

/** هل العنصر مسموح؟ hasPerm بيتحقن من برّه (السيرفر بيقرا role_permissions) */
export function navAllowed(item: NavItem, roles: readonly Role[], hasPerm: (p: Permission) => boolean): boolean {
  if (item.roles && !roles.some((r) => item.roles!.includes(r))) return false;
  if (item.perm && !hasPerm(item.perm)) return false;
  return true;
}

/** القائمة بعد الفلترة (بتتبعت للـ client) */
export type AllowedNavSection = { title: string; items: NavItem[] };
