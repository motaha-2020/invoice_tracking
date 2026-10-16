import type { InvoiceStatus, Role, ScopeType } from "@it/db";

/** أسماء الأدوار في الواجهة (من الديمو) */
export const ROLE_LABELS: Record<Role, string> = {
  admin: "مدير النظام",
  pmo: "مكتب إدارة المشروعات (PMO)",
  company: "المقاول (الشركة المنفذة)",
  supervisor: "مشرف تنفيذ",
  exec_mgr: "مدير تنفيذ",
  gm: "مدير عام",
  tech_affairs: "الشئون الفنية",
  tech_office: "مكتب فني",
  planning: "التخطيط",
  sector_head: "رئيس قطاع",
  presidency_head: "رئاسة القطاعات",
  committee: "اللجنة العليا",
  stores: "المخازن والمشتريات",
  finance: "الإدارة المالية",
};

export const SCOPE_TYPE_LABELS: Record<ScopeType, string> = {
  all: "جميع الجهات",
  company: "شركة منفذة",
  presidency: "رئاسة قطاعات",
  sector: "قطاع",
  general_dept: "إدارة عامة",
  dept: "إدارة مختصة",
  central: "سنترال",
};

export type Tone = "g" | "a" | "r" | "b" | "n" | "p";

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  draft: { label: "مسودة", tone: "n" },
  active: { label: "قيد المراجعة", tone: "p" },
  returned: { label: "معاد للاستيفاء", tone: "b" },
  on_hold: { label: "موقوف مؤقتاً", tone: "a" },
  paid: { label: "تم السداد", tone: "g" },
};

/** شيل اللقب (م. / أ.) وخد أول حرف — للـ avatar */
export function initialOf(name: string): string {
  return name.replace(/^(م\.|أ\.)\s*/, "").trim().slice(0, 1) || "؟";
}
