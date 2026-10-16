import "server-only";
import { prisma, Prisma } from "@it/db";

/**
 * قراءة العقود وأوامر التكليف للصفحات. الـ where (النطاق) جاي جاهز من الـ service.
 *
 * "المفوتر" = المستخلصات غير المسودة: آخر نسخة (revision) من كل مستخلص،
 * Σ (الكمية المعتمدة أو المقدمة لو لسه ما اتعتمدتش) × (سعر العقد أو السعر المتفق عليه للبند المستجد).
 * المستخلصات المرحّلة (migrated) من غير بنود بتتحسب بـ migrated_amount.
 */

const listSelect = {
  id: true,
  contractNo: true,
  title: true,
  currency: true,
  contractValue: true,
  payMonthlyPct: true,
  payAsbuiltPct: true,
  payHandoverPct: true,
  company: { select: { id: true, name: true, code: true } },
  _count: { select: { items: { where: { isGroup: false } }, assignmentOrders: true } },
} satisfies Prisma.ContractSelect;

export type ContractListRow = Prisma.ContractGetPayload<{ select: typeof listSelect }>;

export function listContracts(where: Prisma.ContractWhereInput): Promise<ContractListRow[]> {
  return prisma.contract.findMany({ where, select: listSelect, orderBy: { contractNo: "asc" } });
}

export async function sumAoValueByContract(contractIds: string[]): Promise<Map<string, string>> {
  if (!contractIds.length) return new Map();
  const rows = await prisma.assignmentOrder.groupBy({ by: ["contractId"], where: { contractId: { in: contractIds } }, _sum: { value: true } });
  return new Map(rows.map((r) => [r.contractId, r._sum.value?.toString() ?? "0"]));
}

export type BilledRow = { aoId: string; contractId: string; billed: string; invoices: number };

/** المفوتر وعدد المستخلصات (غير المسودة) لكل أمر تكليف في العقود دي */
export function billedByAo(contractIds: string[]): Promise<BilledRow[]> {
  if (!contractIds.length) return Promise.resolve([]);
  return prisma.$queryRaw<BilledRow[]>`
    SELECT i.ao_id AS "aoId", i.contract_id AS "contractId",
           COALESCE(SUM(CASE WHEN i.migrated THEN COALESCE(i.migrated_amount, 0) ELSE COALESCE(x.total, 0) END), 0)::text AS billed,
           COUNT(*)::int AS invoices
    FROM invoices i
    LEFT JOIN LATERAL (
      SELECT SUM(COALESCE(l.approved_qty, l.qty) * COALESCE(ci.unit_price, l.agreed_price, 0)) AS total
      FROM invoice_lines l
      LEFT JOIN contract_items ci ON ci.id = l.contract_item_id
      WHERE l.revision_id = (SELECT r.id FROM invoice_revisions r WHERE r.invoice_id = i.id ORDER BY r.n DESC LIMIT 1)
    ) x ON true
    WHERE i.status <> 'draft' AND i.contract_id IN (${Prisma.join(contractIds)})
    GROUP BY i.ao_id, i.contract_id`;
}

export type BilledItemRow = { contractItemId: string; siteId: string | null; qty: string };

/** الكميات المفوترة تراكمياً على أمر التكليف لكل (بند، موقع) */
export function billedQtyByItem(aoId: string): Promise<BilledItemRow[]> {
  return prisma.$queryRaw<BilledItemRow[]>`
    SELECT l.contract_item_id AS "contractItemId", l.site_id AS "siteId", SUM(COALESCE(l.approved_qty, l.qty))::text AS qty
    FROM invoices i
    JOIN invoice_revisions r ON r.id = (SELECT r2.id FROM invoice_revisions r2 WHERE r2.invoice_id = i.id ORDER BY r2.n DESC LIMIT 1)
    JOIN invoice_lines l ON l.revision_id = r.id
    WHERE i.status <> 'draft' AND i.ao_id = ${aoId} AND l.contract_item_id IS NOT NULL
    GROUP BY l.contract_item_id, l.site_id`;
}

const aoListSelect = {
  id: true,
  aoNo: true,
  name: true,
  status: true,
  value: true,
  financialCommitment: true,
  centralText: true,
  project: { select: { id: true, name: true, code: true, central: { select: { name: true } } } },
  _count: { select: { sites: true } },
} satisfies Prisma.AssignmentOrderSelect;

export type AoListRow = Prisma.AssignmentOrderGetPayload<{ select: typeof aoListSelect }>;

export function findContract(id: string, where: Prisma.ContractWhereInput) {
  return prisma.contract.findFirst({
    where: { AND: [{ id }, where] },
    include: {
      company: { select: { id: true, name: true, code: true } },
      items: {
        select: { id: true, itemNo: true, isGroup: true, description: true, unit: true, contractQty: true, unitPrice: true, workType: true },
        orderBy: [{ sortOrder: "asc" }, { itemNo: "asc" }],
      },
      assignmentOrders: { select: aoListSelect, orderBy: { aoNo: "asc" } },
    },
  });
}

export type ContractDetail = NonNullable<Awaited<ReturnType<typeof findContract>>>;

export function findAoDetail(contractId: string, aoId: string, where: Prisma.ContractWhereInput) {
  return prisma.assignmentOrder.findFirst({
    where: { id: aoId, contractId, contract: where },
    include: {
      contract: { select: { id: true, contractNo: true, title: true, company: { select: { id: true, name: true } } } },
      project: { select: { id: true, name: true, code: true, central: { select: { name: true } } } },
      changes: { orderBy: [{ changeDate: "asc" }, { id: "asc" }] },
      sites: { select: { id: true, code: true, name: true, _count: { select: { aoItems: true } } }, orderBy: { code: "asc" } },
      items: {
        select: {
          id: true,
          plannedQty: true,
          siteId: true,
          site: { select: { code: true } },
          contractItem: { select: { id: true, itemNo: true, description: true, unit: true, unitPrice: true, sortOrder: true } },
        },
      },
      materials: {
        select: { id: true, plannedQty: true, material: { select: { code: true, description: true, unit: true } } },
        orderBy: { material: { code: "asc" } },
      },
      _count: { select: { invoices: { where: { status: { not: "draft" } } } } },
    },
  });
}

export type AoDetail = NonNullable<Awaited<ReturnType<typeof findAoDetail>>>;
