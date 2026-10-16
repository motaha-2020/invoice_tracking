/**
 * فلاتر التقارير والتصدير — دوال صافية (من غير DB) عشان تتختبر.
 * نفس الفلتر بيتطبق على الشاشة وعلى ملف Excel (الـ query string واحد).
 */
import type { InvoiceStatus, Prisma } from "@it/db";

export const ORG_KEYS = ["presidency", "sector", "generalDept", "dept", "central", "project"] as const;
export type OrgKey = (typeof ORG_KEYS)[number];

export type ReportFilter = {
  company?: string;
  contract?: string;
  presidency?: string;
  sector?: string;
  generalDept?: string;
  dept?: string;
  central?: string;
  project?: string;
  status?: InvoiceStatus | "open";
  category?: string;
  /** تاريخ التقديم من / إلى (yyyy-mm-dd) */
  from?: string;
  to?: string;
};

const KEYS = ["company", "contract", ...ORG_KEYS, "status", "category", "from", "to"] as const;
const STATUSES = ["active", "returned", "on_hold", "paid", "open"] as const;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function parseFilter(sp: Record<string, string | string[] | undefined>): ReportFilter {
  const one = (k: string) => {
    const v = sp[k];
    return typeof v === "string" && v.trim() && v.length <= 64 ? v.trim() : undefined;
  };
  const f: ReportFilter = {};
  for (const k of ["company", "contract", ...ORG_KEYS] as const) f[k] = one(k);
  const st = one("status");
  if (st && (STATUSES as readonly string[]).includes(st)) f.status = st as ReportFilter["status"];
  const cat = one("category");
  if (cat && /^C[1-5]$/.test(cat)) f.category = cat;
  const from = one("from");
  const to = one("to");
  if (from && ISO.test(from)) f.from = from;
  if (to && ISO.test(to)) f.to = to;
  return f;
}

export function filterQuery(f: ReportFilter): string {
  const qs = new URLSearchParams();
  for (const k of KEYS) {
    const v = f[k];
    if (v) qs.set(k, v);
  }
  return qs.toString();
}

export function activeFilterCount(f: ReportFilter): number {
  return KEYS.filter((k) => f[k]).length;
}

/** شرط Prisma للفلتر — بيتضاف فوق شرط النطاق (visibleInvoicesWhere)، والمسودات مستبعدة دايماً */
export function filterWhere(f: ReportFilter): Prisma.InvoiceWhereInput {
  const and: Prisma.InvoiceWhereInput[] = [{ status: { not: "draft" } }];
  if (f.company) and.push({ contract: { companyId: f.company } });
  if (f.contract) and.push({ contractId: f.contract });
  if (f.project) and.push({ ao: { projectId: f.project } });
  if (f.central) and.push({ ao: { project: { centralId: f.central } } });
  if (f.dept) and.push({ ao: { project: { central: { deptId: f.dept } } } });
  if (f.generalDept) and.push({ ao: { project: { central: { dept: { generalDeptId: f.generalDept } } } } });
  if (f.sector) and.push({ ao: { project: { central: { dept: { generalDept: { sectorId: f.sector } } } } } });
  if (f.presidency) and.push({ ao: { project: { central: { dept: { generalDept: { sector: { presidencyId: f.presidency } } } } } } });
  if (f.status === "open") and.push({ status: { in: ["active", "returned", "on_hold"] } });
  else if (f.status) and.push({ status: f.status });
  if (f.category) and.push({ OR: [{ category: f.category }, { category: null, suggestedCategory: f.category }] });
  if (f.from) and.push({ submittedAt: { gte: new Date(`${f.from}T00:00:00+02:00`) } });
  if (f.to) and.push({ submittedAt: { lt: new Date(new Date(`${f.to}T00:00:00+02:00`).getTime() + 86_400_000) } });
  return { AND: and };
}
