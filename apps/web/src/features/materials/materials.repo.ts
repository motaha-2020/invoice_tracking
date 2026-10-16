import "server-only";
import { prisma, type Prisma } from "@it/db";

/**
 * المهمات: الكتالوج + المنصرف + بيانات المقارنة. كل استعلام على أوامر التكليف بياخد `aoWhere`
 * جاهز من ao-scope.ts (المبني من scopeWhere) — الـ repo ما يبنيش نطاق بنفسه.
 */
type AoWhere = Prisma.AssignmentOrderWhereInput;
type Db = Prisma.TransactionClient | typeof prisma;

// ─────────── الكتالوج ───────────

export function findMaterialsByCodes(codes: string[]) {
  return prisma.material.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true, unit: true, description: true, _count: { select: { issues: true } } },
  });
}

export function searchMaterials(q: string | undefined, take = 500) {
  const where: Prisma.MaterialWhereInput = q
    ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }, { groupName: { contains: q, mode: "insensitive" } }] }
    : {};
  return Promise.all([
    prisma.material.findMany({ where, orderBy: { code: "asc" }, take }),
    prisma.material.count({ where }),
  ]);
}

export function listMaterialOptions() {
  return prisma.material.findMany({ select: { id: true, code: true, description: true }, orderBy: { code: "asc" } });
}

export function upsertMaterial(db: Db, m: { code: string; description: string; unit: string; suppliedBy: string | null; groupName: string | null }) {
  const { code, ...rest } = m;
  return db.material.upsert({ where: { code }, create: m, update: rest });
}

// ─────────── العقود وأوامر التكليف ───────────

export function listContractKeys() {
  return prisma.contract.findMany({ select: { id: true, contractNo: true } });
}

export function listAosOfContracts(contractIds: string[]) {
  return prisma.assignmentOrder.findMany({
    where: { contractId: { in: contractIds } },
    select: { id: true, contractId: true, aoNo: true, name: true, status: true },
  });
}

/** ids أوامر التكليف (من القائمة دي) اللي في النطاق */
export async function aoIdsInScope(ids: string[], aoWhere: AoWhere): Promise<Set<string>> {
  const rows = await prisma.assignmentOrder.findMany({ where: { AND: [{ id: { in: ids } }, aoWhere] }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

/** فلاتر الصفحة: العقود وأوامر التكليف اللي في النطاق */
export function listAoOptions(aoWhere: AoWhere) {
  return prisma.assignmentOrder.findMany({
    where: aoWhere,
    select: { id: true, aoNo: true, name: true, contractId: true, contract: { select: { contractNo: true, company: { select: { name: true } } } } },
    orderBy: [{ contract: { contractNo: "asc" } }, { aoNo: "asc" }],
  });
}

// ─────────── المنصرف ───────────

/** أذون الصرف الموجودة + المخطط — للفحص قبل الاستيراد */
export function issueContext(aoIds: string[], materialIds: string[]) {
  return Promise.all([
    prisma.materialIssue.findMany({
      where: { aoId: { in: aoIds }, materialId: { in: materialIds } },
      select: { id: true, aoId: true, materialId: true, issueRef: true, qty: true, returnedQty: true },
    }),
    prisma.aoMaterial.findMany({
      where: { aoId: { in: aoIds }, materialId: { in: materialIds } },
      select: { aoId: true, materialId: true, plannedQty: true },
    }),
  ]);
}

export async function upsertIssue(
  db: Db,
  d: { aoId: string; materialId: string; issueRef: string; qty: number; returnedQty: number; issueDate: Date },
): Promise<"create" | "update"> {
  // مفيش unique في الجدول — المفتاح المنطقي (أمر التكليف، الصنف، رقم الإذن)
  const existing = await db.materialIssue.findFirst({
    where: { aoId: d.aoId, materialId: d.materialId, issueRef: d.issueRef },
    select: { id: true },
  });
  if (existing) {
    await db.materialIssue.update({ where: { id: existing.id }, data: { qty: d.qty, returnedQty: d.returnedQty, issueDate: d.issueDate } });
    return "update";
  }
  await db.materialIssue.create({ data: d });
  return "create";
}

export type IssueFilter = { contractId?: string; aoId?: string; materialId?: string };

export function listIssues(aoWhere: AoWhere, f: IssueFilter, take = 500) {
  const where: Prisma.MaterialIssueWhereInput = {
    ao: { AND: [aoWhere, f.contractId ? { contractId: f.contractId } : {}, f.aoId ? { id: f.aoId } : {}] },
    ...(f.materialId ? { materialId: f.materialId } : {}),
  };
  return Promise.all([
    prisma.materialIssue.findMany({
      where,
      select: {
        id: true,
        qty: true,
        returnedQty: true,
        issueDate: true,
        issueRef: true,
        material: { select: { code: true, description: true, unit: true } },
        ao: { select: { aoNo: true, name: true, contract: { select: { contractNo: true, company: { select: { name: true } } } } } },
      },
      orderBy: [{ issueDate: "desc" }, { id: "asc" }],
      take,
    }),
    prisma.materialIssue.count({ where }),
  ]);
}

// ─────────── المقارنة ───────────

/** كل اللي محتاجينه لمقارنة أوامر التكليف: المخطط + المنصرف + المنفذ (آخر نسخة من كل مستخلص مش مسودة) */
export function comparisonData(aoWhere: AoWhere, f: IssueFilter, takeAos = 100) {
  const mat = f.materialId ? { materialId: f.materialId } : {};
  return prisma.assignmentOrder.findMany({
    where: { AND: [aoWhere, f.contractId ? { contractId: f.contractId } : {}, f.aoId ? { id: f.aoId } : {}] },
    select: {
      id: true,
      aoNo: true,
      name: true,
      contract: { select: { contractNo: true } },
      materials: { where: mat, select: { materialId: true, plannedQty: true } },
      issues: { where: mat, select: { materialId: true, qty: true, returnedQty: true } },
      invoices: {
        where: { status: { not: "draft" } },
        select: {
          revisions: {
            orderBy: { n: "desc" },
            take: 1,
            select: { materials: { where: mat, select: { materialId: true, executedQty: true, billedQty: true } } },
          },
        },
      },
    },
    orderBy: [{ contract: { contractNo: "asc" } }, { aoNo: "asc" }],
    take: takeAos,
  });
}

export function materialsByIds(ids: string[]) {
  return prisma.material.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, description: true, unit: true } });
}
