import "server-only";
import { prisma, type Prisma } from "@it/db";
import { grossByIds } from "@/features/invoices/invoices.repo";

/**
 * بيانات لوحة المؤشرات وصفحات الشركة والمشروع — الـ where (النطاق + الفلتر) بييجي جاهز من الـ service.
 * القيم كلها غير شاملة الضريبة: المستخلص بقيمته المعتمدة (آخر نسخة)، والمرحّل بقيمته المرحّلة.
 */
const ref = { id: true, name: true } as const;
const projectRef = { id: true, code: true, name: true } as const;

const invoiceSelect = {
  id: true,
  invoiceNo: true,
  status: true,
  currentStep: true,
  heldAt: true,
  workType: { select: { name: true } },
  contract: { select: { id: true, contractNo: true, company: { select: ref } } },
  ao: { select: { id: true, aoNo: true, project: { select: projectRef } } },
} satisfies Prisma.InvoiceSelect;

export type InvoiceFactRow = Prisma.InvoiceGetPayload<{ select: typeof invoiceSelect }> & { gross: number };

export const FACTS_LIMIT = 10_000;

export async function loadInvoiceFacts(where: Prisma.InvoiceWhereInput): Promise<InvoiceFactRow[]> {
  const rows = await prisma.invoice.findMany({ where, select: invoiceSelect, take: FACTS_LIMIT });
  const gross = await grossByIds(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, gross: gross.get(r.id) ?? 0 }));
}

const aoSelect = {
  id: true,
  aoNo: true,
  name: true,
  status: true,
  value: true,
  financialCommitment: true,
  contract: { select: { id: true, contractNo: true, company: { select: ref } } },
  project: { select: projectRef },
} satisfies Prisma.AssignmentOrderSelect;

export type AoFactRow = Prisma.AssignmentOrderGetPayload<{ select: typeof aoSelect }>;

export function loadAoFacts(where: Prisma.AssignmentOrderWhereInput): Promise<AoFactRow[]> {
  return prisma.assignmentOrder.findMany({ where, select: aoSelect, orderBy: [{ contract: { contractNo: "asc" } }, { aoNo: "asc" }] });
}

const contractSelect = { id: true, contractNo: true, title: true, contractValue: true, company: { select: ref } } satisfies Prisma.ContractSelect;

export type ContractFactRow = Prisma.ContractGetPayload<{ select: typeof contractSelect }>;

export function loadContractFacts(where: Prisma.ContractWhereInput): Promise<ContractFactRow[]> {
  return prisma.contract.findMany({ where, select: contractSelect, orderBy: { contractNo: "asc" } });
}

export function findCompany(id: string) {
  return prisma.company.findUnique({ where: { id }, select: { id: true, code: true, name: true, fullName: true, email: true, phone: true } });
}

export function findProject(id: string) {
  return prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      type: { select: { name: true } },
      central: { select: { name: true, dept: { select: { name: true, generalDept: { select: { name: true, sector: { select: { name: true } } } } } } } },
    },
  });
}
