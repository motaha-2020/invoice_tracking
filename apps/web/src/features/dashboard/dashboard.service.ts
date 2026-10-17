import "server-only";
import type { Prisma } from "@it/db";
import type { SessionUser } from "@/features/auth/auth.types";
import { visibleInvoicesWhere } from "@/features/auth/scope";
import { contractsScopeWhere } from "@/features/contracts/contracts.rules";
import * as repo from "@/features/insights/insights.repo";
import { summarize, type MoneyTotals, type StageSlice } from "@/features/insights/insights.rules";
import { getFlowContext } from "@/features/invoices/flow-config";
import { getWorkflowSteps, listInvoicesWhere } from "@/features/invoices/invoices.service";
import { aoScopeWhere, isUnscoped } from "@/features/materials/ao-scope";
import { filterWhere, type ReportFilter } from "@/features/reports/reports.filters";
import { getFilterOptions, type FilterOptions } from "@/features/reports/reports.service";
import { orgTiles, stageProgress, type StageProgress, type Tile } from "./dashboard.rules";

/**
 * لوحة المؤشرات (/dashboard): نفس فلاتر التقارير كـ slicers، وكله في نطاق صلاحية المستخدم.
 * المستخلصات: نطاق المستخدم + الفلتر (من غير المسودات). أوامر التكليف: نطاقه + الفلاتر اللي تخص أمر التكليف.
 */
export type Dashboard = {
  totals: MoneyTotals;
  byStage: StageSlice[];
  tiles: Tile[];
  tileLevel: "generalDept" | "central";
  progress: StageProgress[];
  stepNames: Record<string, string>;
  sla: { onTime: number; active: number };
  options: FilterOptions;
};

/** فلاتر الهيكل والعقد على أمر التكليف (الحالة والفئة والتاريخ تخص المستخلص بس) */
function aoFilterWhere(f: ReportFilter): Prisma.AssignmentOrderWhereInput {
  const and: Prisma.AssignmentOrderWhereInput[] = [];
  if (f.company) and.push({ contract: { companyId: f.company } });
  if (f.contract) and.push({ contractId: f.contract });
  if (f.project) and.push({ projectId: f.project });
  if (f.central) and.push({ project: { centralId: f.central } });
  if (f.dept) and.push({ project: { central: { deptId: f.dept } } });
  if (f.generalDept) and.push({ project: { central: { dept: { generalDeptId: f.generalDept } } } });
  if (f.sector) and.push({ project: { central: { dept: { generalDept: { sectorId: f.sector } } } } });
  if (f.presidency) and.push({ project: { central: { dept: { generalDept: { sector: { presidencyId: f.presidency } } } } } });
  return { AND: and };
}

export async function getInvoiceDashboard(user: SessionUser, f: ReportFilter): Promise<Dashboard> {
  const aoScope = aoScopeWhere(user);
  const fw = filterWhere(f);
  const [invoices, aos, steps, ctx, options, active] = await Promise.all([
    repo.loadInvoiceFacts({ AND: [visibleInvoicesWhere(user), fw] }),
    repo.loadAoFacts({ AND: [aoScope, aoFilterWhere(f)] }),
    getWorkflowSteps(),
    getFlowContext(),
    getFilterOptions(user),
    f.status && f.status !== "active" && f.status !== "open" ? Promise.resolve([]) : listInvoicesWhere(user, { AND: [fw, { status: "active" }] }, 5000),
  ]);
  const contractIds = [...new Set(aos.map((a) => a.contract.id))];
  const contracts = await repo.loadContractFacts(
    isUnscoped(aoScope) && !f.contract && !f.company && !hasOrgFilter(f) ? contractsScopeWhere(user) : { id: { in: f.contract ? [f.contract] : contractIds } },
  );

  const order = steps.map((s) => s.key).filter((k) => k !== "company");
  const insights = summarize(invoices, aos, contracts, order);
  const paths = Object.fromEntries(Object.entries(ctx.config.categories).map(([c, d]) => [c, d.path.map((p) => p.step)]));
  const tileLevel = f.generalDept || f.dept ? "central" : "generalDept";

  return {
    totals: insights.totals,
    byStage: insights.byStage,
    tiles: orgTiles(invoices, aos, tileLevel),
    tileLevel,
    progress: stageProgress(invoices, paths, order),
    stepNames: Object.fromEntries(steps.map((s) => [s.key, s.name])),
    sla: { onTime: active.filter((i) => i.sla.k !== "late").length, active: active.length },
    options,
  };
}

const hasOrgFilter = (f: ReportFilter) => !!(f.presidency || f.sector || f.generalDept || f.dept || f.central || f.project);
