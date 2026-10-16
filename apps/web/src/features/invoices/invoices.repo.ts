import "server-only";
import { prisma, type InvoiceStatus, type Prisma } from "@it/db";

/**
 * قراءة المستخلصات. كل دالة هنا بتاخد `where` جاهز من scope.ts (scopeWhere / visibleInvoicesWhere / inboxWhere)
 * — الـ repo ما يبنيش نطاق بنفسه، والـ service هو اللي بيختار الشرط.
 */
type Where = Prisma.InvoiceWhereInput;

export async function countByStatus(where: Where): Promise<Partial<Record<InvoiceStatus, number>>> {
  const rows = await prisma.invoice.groupBy({ by: ["status"], where, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
}

export function countInvoices(where: Where): Promise<number> {
  return prisma.invoice.count({ where });
}

const listSelect = {
  id: true,
  invoiceNo: true,
  seq: true,
  workType: { select: { name: true } },
  pathName: true,
  status: true,
  currentStep: true,
  returnTo: true,
  since: true,
  category: true,
  suggestedCategory: true,
  holdReason: true,
  contract: { select: { contractNo: true, company: { select: { name: true } } } },
  ao: {
    select: {
      aoNo: true,
      project: { select: { name: true, central: { select: { name: true } } } },
    },
  },
} satisfies Prisma.InvoiceSelect;

export type InvoiceListRow = Prisma.InvoiceGetPayload<{ select: typeof listSelect }>;

export function listInvoices(where: Where, opts: { take?: number } = {}): Promise<InvoiceListRow[]> {
  return prisma.invoice.findMany({
    where,
    select: listSelect,
    orderBy: [{ since: "asc" }, { id: "asc" }],
    take: opts.take ?? 200,
  });
}

export function listWorkflowSteps() {
  return prisma.workflowStep.findMany({
    select: { key: true, name: true, short: true, role: true },
    orderBy: { sort: "asc" },
  });
}
