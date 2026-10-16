import "server-only";
import { prisma, Prisma, type InvoiceStatus } from "@it/db";

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

/** القيمة المعتمدة (آخر نسخة) لكل مستخلص — المرحّل بقيمته المرحّلة */
export async function grossByIds(ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await prisma.$queryRaw<{ id: string; gross: string }[]>`
    SELECT i.id, (CASE WHEN i.migrated THEN COALESCE(i.migrated_amount, 0) ELSE COALESCE(x.total, 0) END)::text AS gross
    FROM invoices i
    LEFT JOIN LATERAL (
      SELECT SUM(COALESCE(l.approved_qty, l.qty) * COALESCE(ci.unit_price, l.agreed_price, 0)) AS total
      FROM invoice_lines l
      LEFT JOIN contract_items ci ON ci.id = l.contract_item_id
      WHERE l.revision_id = (SELECT r.id FROM invoice_revisions r WHERE r.invoice_id = i.id ORDER BY r.n DESC LIMIT 1)
    ) x ON true
    WHERE i.id IN (${Prisma.join(ids)})`;
  return new Map(rows.map((r) => [r.id, Number(r.gross)]));
}

export function listWorkflowSteps() {
  return prisma.workflowStep.findMany({
    select: { key: true, name: true, short: true, role: true },
    orderBy: { sort: "asc" },
  });
}
