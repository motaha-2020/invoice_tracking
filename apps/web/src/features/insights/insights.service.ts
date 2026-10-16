import "server-only";
import type { Prisma } from "@it/db";
import type { SessionUser } from "@/features/auth/auth.types";
import { visibleInvoicesWhere } from "@/features/auth/scope";
import { contractsScopeWhere } from "@/features/contracts/contracts.rules";
import { getWorkflowSteps, listInvoicesWhere, type InvoiceListRow } from "@/features/invoices/invoices.service";
import { aoScopeWhere, isUnscoped } from "@/features/materials/ao-scope";
import * as repo from "./insights.repo";
import { summarize, type Insights } from "./insights.rules";

/**
 * لوحة المؤشرات المالية + ملخص الشركة + ملخص المشروع. كله في نطاق صلاحية المستخدم:
 * المستخلصات بـ visibleInvoicesWhere، وأوامر التكليف بـ aoScopeWhere، والعقود اللي ليها أمر تكليف في النطاق
 * (أو كل العقود المتاحة لو النطاق مفتوح).
 */
type Filter = { invoices?: Prisma.InvoiceWhereInput; aos?: Prisma.AssignmentOrderWhereInput; contracts?: Prisma.ContractWhereInput };

const and = <T,>(...w: (T | undefined)[]): T => ({ AND: w.filter(Boolean) }) as T;

async function load(user: SessionUser, f: Filter) {
  const aoScope = aoScopeWhere(user);
  const [invoices, aos, steps] = await Promise.all([
    repo.loadInvoiceFacts(and<Prisma.InvoiceWhereInput>(visibleInvoicesWhere(user), f.invoices)),
    repo.loadAoFacts(and<Prisma.AssignmentOrderWhereInput>(aoScope, f.aos)),
    getWorkflowSteps(),
  ]);
  const contractWhere = isUnscoped(aoScope)
    ? and<Prisma.ContractWhereInput>(contractsScopeWhere(user), f.contracts)
    : and<Prisma.ContractWhereInput>({ id: { in: [...new Set(aos.map((a) => a.contract.id))] } }, f.contracts);
  const contracts = await repo.loadContractFacts(contractWhere);
  return { invoices, aos, contracts, insights: summarize(invoices, aos, contracts, steps.map((s) => s.key)) };
}

export type Dashboard = { insights: Insights; truncated: boolean };

export async function getDashboard(user: SessionUser): Promise<Dashboard> {
  const { insights, invoices } = await load(user, {});
  return { insights, truncated: invoices.length >= repo.FACTS_LIMIT };
}

export type CompanyInsights = {
  company: NonNullable<Awaited<ReturnType<typeof repo.findCompany>>>;
  insights: Insights;
  aos: repo.AoFactRow[];
  contracts: repo.ContractFactRow[];
  invoices: InvoiceListRow[];
};

/** ملخص الشركة: عقودها وأوامر تكليفها ومستخلصاتها. null = مش موجودة أو خارج نطاق المستخدم */
export async function getCompanyInsights(user: SessionUser, id: string): Promise<CompanyInsights | null> {
  const company = await repo.findCompany(id);
  if (!company) return null;
  const [data, invoices] = await Promise.all([
    load(user, { invoices: { contract: { companyId: id } }, aos: { contract: { companyId: id } }, contracts: { companyId: id } }),
    listInvoicesWhere(user, { contract: { companyId: id } }),
  ]);
  if (!data.contracts.length && !data.aos.length && !invoices.length) return null;
  return { company, insights: data.insights, aos: data.aos, contracts: data.contracts, invoices };
}

export type ProjectInsights = {
  project: NonNullable<Awaited<ReturnType<typeof repo.findProject>>>;
  insights: Insights;
  aos: repo.AoFactRow[];
  invoices: InvoiceListRow[];
};

/** ملخص المشروع: أوامر التكليف المرتبطة بيه (وعقودها) والمستخلصات عليها */
export async function getProjectInsights(user: SessionUser, id: string): Promise<ProjectInsights | null> {
  const project = await repo.findProject(id);
  if (!project) return null;
  const [data, invoices] = await Promise.all([
    load(user, { invoices: { ao: { projectId: id } }, aos: { projectId: id }, contracts: { assignmentOrders: { some: { projectId: id } } } }),
    listInvoicesWhere(user, { ao: { projectId: id } }),
  ]);
  // مشروع من غير أوامر تكليف بيظهر للنطاق المفتوح بس (عشان ما نكشفش مشروعات برّه النطاق)
  if (!data.aos.length && !invoices.length && !isUnscoped(aoScopeWhere(user))) return null;
  return { project, insights: data.insights, aos: data.aos, invoices };
}
