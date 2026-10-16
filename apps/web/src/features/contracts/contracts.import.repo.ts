import "server-only";
import { prisma, Prisma } from "@it/db";

/**
 * الوصول للداتا الخاص بقوالب 05 (العقد والمقايسة) و06 (أمر التكليف).
 * القراءات (find*) للـ validate، والكتابات بتاخد tx من محرك الاستيراد.
 */
type Tx = Prisma.TransactionClient;

// ─────────────────────────── 05 العقد والمقايسة ───────────────────────────

export function findCompanyByCode(code: string) {
  return prisma.company.findUnique({ where: { code }, select: { id: true, code: true, name: true } });
}

export function findContractForBoq(contractNo: string) {
  return prisma.contract.findUnique({
    where: { contractNo },
    select: {
      id: true,
      companyId: true,
      company: { select: { name: true } },
      items: {
        select: {
          itemNo: true,
          isGroup: true,
          unitPrice: true,
          _count: { select: { aoItems: true, invoiceLines: true } },
        },
      },
    },
  });
}

export type ContractWrite = Omit<Prisma.ContractUncheckedCreateInput, "id" | "items" | "assignmentOrders" | "invoices">;

export function upsertContract(tx: Tx, data: ContractWrite) {
  return tx.contract.upsert({
    where: { contractNo: data.contractNo },
    create: data,
    update: data,
    select: { id: true },
  });
}

export function listContractItemIds(tx: Tx, contractId: string) {
  return tx.contractItem.findMany({ where: { contractId }, select: { id: true, itemNo: true } });
}

export type BoqItemWrite = {
  itemNo: string;
  parentNo: string | null;
  isGroup: boolean;
  description: string;
  unit: string | null;
  contractQty: number | null;
  unitPrice: number | null;
  workType: string | null;
  sortOrder: number;
};

export function createContractItems(tx: Tx, contractId: string, items: BoqItemWrite[]) {
  if (!items.length) return Promise.resolve({ count: 0 });
  return tx.contractItem.createMany({ data: items.map((i) => ({ ...i, contractId })), skipDuplicates: true });
}

const str = (v: number | boolean | string | null) => (v == null ? null : String(v));

/**
 * تحديث بنود موجودة بـ UPDATE ... FROM (VALUES ...) — query واحدة لكل 500 بند
 * بدل 470 round-trip. البنود مش بتتمسح أبداً (ممكن تكون عليها أوامر تكليف أو مستخلصات).
 */
export async function updateContractItems(tx: Tx, rows: (BoqItemWrite & { id: string })[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values = Prisma.join(
      chunk.map(
        (r) =>
          Prisma.sql`(${r.id}::text, ${r.parentNo}::text, ${str(r.isGroup)}::text, ${r.description}::text, ${r.unit}::text, ${str(r.contractQty)}::text, ${str(r.unitPrice)}::text, ${r.workType}::text, ${str(r.sortOrder)}::text)`,
      ),
    );
    n += await tx.$executeRaw`
      UPDATE contract_items AS c SET
        parent_no = v.parent_no,
        is_group = v.is_group::boolean,
        description = v.description,
        unit = v.unit,
        contract_qty = v.contract_qty::numeric(18,4),
        unit_price = v.unit_price::numeric(18,2),
        work_type = v.work_type,
        sort_order = v.sort_order::int
      FROM (VALUES ${values}) AS v(id, parent_no, is_group, description, unit, contract_qty, unit_price, work_type, sort_order)
      WHERE c.id = v.id`;
  }
  return n;
}

// ─────────────────────────── 06 أمر التكليف ───────────────────────────

export function findContractForAo(contractNo: string) {
  return prisma.contract.findUnique({
    where: { contractNo },
    select: {
      id: true,
      contractNo: true,
      items: { select: { id: true, itemNo: true, isGroup: true, unitPrice: true } },
    },
  });
}

export function findAo(contractId: string, aoNo: string) {
  return prisma.assignmentOrder.findUnique({
    where: { contractId_aoNo: { contractId, aoNo } },
    select: {
      id: true,
      value: true,
      financialCommitment: true,
      projectId: true,
      changes: { select: { kind: true, reference: true } },
      sites: { select: { code: true } },
      items: { select: { contractItemId: true, plannedQty: true, site: { select: { code: true } } } },
      materials: { select: { materialId: true, plannedQty: true } },
    },
  });
}

export function findProjectByCode(code: string) {
  return prisma.project.findUnique({ where: { code }, select: { id: true, name: true } });
}

export function listMaterialCodes() {
  return prisma.material.findMany({ select: { id: true, code: true } });
}

export type AoWrite = Omit<Prisma.AssignmentOrderUncheckedCreateInput, "id" | "contractId" | "aoNo">;

export function createAo(tx: Tx, contractId: string, aoNo: string, data: AoWrite) {
  return tx.assignmentOrder.create({ data: { ...data, contractId, aoNo }, select: { id: true } });
}

export function updateAo(tx: Tx, id: string, data: Prisma.AssignmentOrderUncheckedUpdateInput) {
  return tx.assignmentOrder.update({ where: { id }, data, select: { id: true } });
}

export function getAoForUpdate(tx: Tx, id: string) {
  return tx.assignmentOrder.findUniqueOrThrow({ where: { id }, select: { value: true, financialCommitment: true } });
}

export function createAoChange(tx: Tx, data: Prisma.AoChangeUncheckedCreateInput) {
  return tx.aoChange.create({ data });
}

/** المواقع: بيتعملوا لو مش موجودين، وبيرجع code ← id */
export async function ensureSites(tx: Tx, aoId: string, codes: string[]): Promise<Map<string, string>> {
  if (codes.length) {
    await tx.aoSite.createMany({ data: codes.map((code) => ({ aoId, code, name: `موقع ${code}` })), skipDuplicates: true });
  }
  const sites = await tx.aoSite.findMany({ where: { aoId }, select: { id: true, code: true } });
  return new Map(sites.map((s) => [s.code, s.id]));
}

export function listAoItems(tx: Tx, aoId: string) {
  return tx.aoItem.findMany({ where: { aoId }, select: { id: true, contractItemId: true, siteId: true, plannedQty: true } });
}

export function deleteAoItems(tx: Tx, aoId: string) {
  return tx.aoItem.deleteMany({ where: { aoId } });
}

export function createAoItems(tx: Tx, rows: Prisma.AoItemCreateManyInput[]) {
  return rows.length ? tx.aoItem.createMany({ data: rows }) : Promise.resolve({ count: 0 });
}

export function setAoItemQty(tx: Tx, id: string, plannedQty: number) {
  return tx.aoItem.update({ where: { id }, data: { plannedQty } });
}

export function listAoMaterials(tx: Tx, aoId: string) {
  return tx.aoMaterial.findMany({ where: { aoId }, select: { id: true, materialId: true, plannedQty: true } });
}

export function deleteAoMaterials(tx: Tx, aoId: string) {
  return tx.aoMaterial.deleteMany({ where: { aoId } });
}

export function createAoMaterials(tx: Tx, rows: Prisma.AoMaterialCreateManyInput[]) {
  return rows.length ? tx.aoMaterial.createMany({ data: rows }) : Promise.resolve({ count: 0 });
}

export function setAoMaterialQty(tx: Tx, id: string, plannedQty: number) {
  return tx.aoMaterial.update({ where: { id }, data: { plannedQty } });
}
