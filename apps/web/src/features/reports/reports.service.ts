import "server-only";
import { computeKpis, effectiveCategory, invoiceMetrics, localDate, slaState, type InvoiceMetrics, type KpiInvoice, type Kpis, type SlaState } from "@it/domain";
import type { SessionUser } from "@/features/auth/auth.types";
import { can } from "@/features/auth/permissions";
import { hasRole, visibleInvoicesWhere } from "@/features/auth/scope";
import { getFlowContext, isCategoryCode } from "@/features/invoices/flow-config";
import { grossByIds } from "@/features/invoices/invoices.repo";
import { AppError } from "@/lib/errors";
import { INVOICE_STATUS } from "@/lib/labels";
import { filterWhere, type ReportFilter } from "./reports.filters";
import { REPORT_LIMIT, loadFilterOptions, loadReportInvoices, type ReportInvoiceRow } from "./reports.repo";

/**
 * التقارير: نفس البيانات بتغذي الشاشة وملف Excel والتقرير الأسبوعي.
 * النطاق (visibleInvoicesWhere) + الفلتر، والحسابات كلها من @it/domain (computeKpis).
 */

export type ReportRow = {
  id: string;
  invoiceNo: string;
  company: string;
  contractNo: string;
  aoNo: string;
  project: string;
  central: string;
  dept: string;
  generalDept: string;
  sector: string;
  presidency: string;
  workType: string;
  category: string;
  categoryFinal: boolean;
  status: string;
  statusLabel: string;
  holder: string;
  submittedAt: string | null;
  paidAt: string | null;
  gross: number;
  paidAmount: number | null;
  aoId: string;
  aoValue: number;
  metrics: InvoiceMetrics;
  /** حالة المدة المستهدفة في المرحلة الحالية (نفس حساب المهام الواردة) */
  sla: SlaState;
  reasons: string[];
};

export type Report = {
  rows: ReportRow[];
  kpis: Kpis;
  truncated: boolean;
  aoValueTotal: number;
  byCompany: { company: string; count: number; gross: number; paid: number; open: number }[];
  steps: Record<string, string>;
  today: string;
};

function org(r: ReportInvoiceRow) {
  const c = r.ao.project?.central;
  return {
    project: r.ao.project?.name ?? "—",
    central: c?.name ?? "—",
    dept: c?.dept.name ?? "—",
    generalDept: c?.dept.generalDept.name ?? "—",
    sector: c?.dept.generalDept.sector.name ?? "—",
    presidency: c?.dept.generalDept.sector.presidency.name ?? "—",
  };
}

export async function assertReports(user: SessionUser, perm: "reports.view" | "reports.export" = "reports.view") {
  if (!(await can(user, perm))) throw new AppError("FORBIDDEN");
}

export async function buildReport(user: SessionUser, filter: ReportFilter): Promise<Report> {
  const ctx = await getFlowContext();
  const raw = await loadReportInvoices({ AND: [visibleInvoicesWhere(user), filterWhere(filter)] });
  const gross = await grossByIds(raw.map((r) => r.id));
  const today = localDate(new Date());
  const o = { config: ctx.config, holidays: ctx.holidays, today };
  const short = (k: string | null) => (k ? (ctx.config.steps[k]?.short ?? k) : "—");

  const kpiInput: KpiInvoice[] = [];
  const rows: ReportRow[] = raw.map((r) => {
    const cat = effectiveCategory({
      category: isCategoryCode(r.category) ? r.category : null,
      suggestedCategory: isCategoryCode(r.suggestedCategory) ? r.suggestedCategory : null,
    });
    const reasons = r.log.flatMap((e) => e.reasons.map((x) => x.reason.name));
    const k: KpiInvoice = {
      status: r.status,
      category: cat,
      submittedAt: r.submittedAt ? localDate(r.submittedAt) : null,
      paidAt: r.paidAt ? localDate(r.paidAt) : null,
      gross: gross.get(r.id) ?? 0,
      log: r.log.map((e) => ({ action: e.action, fromStep: e.fromStep, toStep: e.toStep, at: localDate(e.at) })),
      reasons,
    };
    kpiInput.push(k);
    const holder =
      r.status === "paid" ? "—"
      : r.status === "returned" ? (r.returnTo === "company" ? r.contract.company.name : short(r.returnTo))
      : short(r.currentStep);
    return {
      id: r.id,
      invoiceNo: r.invoiceNo,
      company: r.contract.company.name,
      contractNo: r.contract.contractNo,
      aoNo: r.ao.aoNo,
      ...org(r),
      workType: r.workType?.name ?? "—",
      category: cat,
      categoryFinal: isCategoryCode(r.category),
      status: r.status,
      statusLabel: INVOICE_STATUS[r.status].label,
      holder,
      submittedAt: k.submittedAt,
      paidAt: k.paidAt,
      gross: k.gross,
      paidAmount: r.paymentAmount == null ? null : Number(r.paymentAmount),
      aoId: r.ao.id,
      aoValue: Number(r.ao.value ?? 0),
      metrics: invoiceMetrics(k, o),
      sla: slaState(
        { status: r.status, since: localDate(r.since), currentStep: r.currentStep, category: isCategoryCode(r.category) ? r.category : null, suggestedCategory: isCategoryCode(r.suggestedCategory) ? r.suggestedCategory : null, returnTo: r.returnTo },
        today,
        ctx.config,
        ctx.holidays,
        ctx.warnAt,
      ),
      reasons,
    };
  });

  const aoValues = new Map(rows.map((r) => [r.aoId, r.aoValue]));
  const companies = new Map<string, Report["byCompany"][number]>();
  for (const r of rows) {
    const c = companies.get(r.company) ?? { company: r.company, count: 0, gross: 0, paid: 0, open: 0 };
    c.count++;
    c.gross += r.gross;
    if (r.status === "paid") c.paid += r.gross;
    else c.open++;
    companies.set(r.company, c);
  }

  return {
    rows,
    kpis: computeKpis(kpiInput, o),
    truncated: raw.length >= REPORT_LIMIT,
    aoValueTotal: [...aoValues.values()].reduce((a, v) => a + v, 0),
    byCompany: [...companies.values()].sort((a, b) => b.gross - a.gross),
    steps: Object.fromEntries(Object.entries(ctx.config.steps).map(([k, v]) => [k, v.short])),
    today,
  };
}

export type FilterOptions = Awaited<ReturnType<typeof getFilterOptions>>;

/** قوائم الفلاتر. المقاول بيشوف شركته وعقودها بس في القوائم (البيانات نفسها متقيدة بالنطاق في كل الأحوال) */
export async function getFilterOptions(user: SessionUser) {
  const [companies, contracts, presidencies, sectors, generalDepts, depts, centrals, projects] = await loadFilterOptions();
  const own = new Set(user.roles.filter((r) => r.role === "company" && r.scopeId).map((r) => r.scopeId!));
  const companyOnly = hasRole(user, "company") && user.roles.every((r) => r.role === "company");
  return {
    companies: companyOnly ? companies.filter((c) => own.has(c.id)) : companies,
    contracts: companyOnly ? contracts.filter((c) => own.has(c.companyId)) : contracts,
    presidencies,
    sectors,
    generalDepts,
    depts,
    centrals,
    projects,
  };
}

const FILTER_LABELS: Record<string, string> = {
  company: "المقاول", contract: "العقد", presidency: "رئاسة القطاعات", sector: "القطاع", generalDept: "الإدارة العامة",
  dept: "الإدارة المختصة", central: "السنترال", project: "المشروع", status: "الحالة", category: "الفئة", from: "التقديم من", to: "التقديم إلى",
};
const STATUS_TEXT: Record<string, string> = { open: "مفتوح", active: "قيد المراجعة", returned: "معاد للاستيفاء", on_hold: "موقوف مؤقتاً", paid: "تم السداد" };

/** الفلتر بالأسماء (لرأس ملف Excel) */
export async function describeFilter(user: SessionUser, f: ReportFilter): Promise<string[]> {
  const o = await getFilterOptions(user);
  const lists: Record<string, { id: string; name: string }[]> = {
    company: o.companies, contract: o.contracts.map((c) => ({ id: c.id, name: c.contractNo })), presidency: o.presidencies, sector: o.sectors,
    generalDept: o.generalDepts, dept: o.depts, central: o.centrals, project: o.projects,
  };
  const out: string[] = [];
  for (const [key, label] of Object.entries(FILTER_LABELS)) {
    const v = f[key as keyof ReportFilter];
    if (!v) continue;
    const name = lists[key]?.find((x) => x.id === v)?.name ?? (key === "status" ? STATUS_TEXT[v] : v);
    out.push(`${label}: ${name}`);
  }
  return out;
}
