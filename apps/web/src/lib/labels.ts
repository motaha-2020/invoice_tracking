import type { InvoiceKind, InvoiceStatus, Role, ScopeType } from "@it/db";

/** أسماء الأدوار في الواجهة (من الديمو) */
export const ROLE_LABELS: Record<Role, string> = {
  admin: "مدير النظام",
  pmo: "فريق المتابعة PMO",
  company: "شركة منفذة",
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
  finance: "المالية",
};

export const SCOPE_TYPE_LABELS: Record<ScopeType, string> = {
  all: "كل الجهات",
  company: "شركة",
  presidency: "رئاسة قطاعات",
  sector: "قطاع",
  general_dept: "إدارة عامة",
  dept: "إدارة",
  central: "سنترال",
};

export type Tone = "g" | "a" | "r" | "b" | "n" | "p";

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  draft: { label: "مسودة", tone: "n" },
  active: { label: "جاري", tone: "p" },
  returned: { label: "مرتجع", tone: "b" },
  on_hold: { label: "معلّق", tone: "a" },
  paid: { label: "تم الصرف", tone: "g" },
};

/** شيل اللقب (م. / أ.) وخد أول حرف — للـ avatar */
export function initialOf(name: string): string {
  return name.replace(/^(م\.|أ\.)\s*/, "").trim().slice(0, 1) || "؟";
}

export const INVOICE_KIND_LABELS: Record<InvoiceKind, string> = {
  civil: "مدني",
  electrical: "كهرباء",
  combined: "مدني وكهرباء",
  planning: "تخطيط",
};
