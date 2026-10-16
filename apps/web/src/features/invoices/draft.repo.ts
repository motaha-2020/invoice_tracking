import "server-only";
import { prisma, type Prisma } from "@it/db";

/** الوصول للداتا الخاص بمسودة المستخلص (المعالج) — شركة المستخدم بتيجي في الـ where من الـ service */

export async function listAllCompanyIds(): Promise<string[]> {
  return (await prisma.company.findMany({ select: { id: true } })).map((c) => c.id);
}

export function listCompanyContracts(companyIds: string[]) {
  return prisma.contract.findMany({
    where: { companyId: { in: companyIds } },
    orderBy: { contractNo: "asc" },
    select: {
      id: true,
      contractNo: true,
      title: true,
      company: { select: { name: true } },
      assignmentOrders: {
        where: { status: { not: "closed" } },
        orderBy: { aoNo: "asc" },
        select: { id: true, aoNo: true, name: true, status: true, project: { select: { name: true } } },
      },
    },
  });
}

export function listActiveWorkTypes() {
  return prisma.workType.findMany({ where: { active: true }, orderBy: [{ sort: "asc" }, { name: "asc" }], select: { id: true, name: true, isPlanning: true } });
}

/** أمر التكليف + كل اللي المعالج محتاجه للمعاينة الفورية في المتصفح */
export function findAoWorkspace(aoId: string, companyIds: string[]) {
  return prisma.assignmentOrder.findFirst({
    where: { id: aoId, status: { not: "closed" }, contract: { companyId: { in: companyIds } } },
    select: {
      id: true,
      aoNo: true,
      name: true,
      status: true,
      value: true,
      financialCommitment: true,
      centralText: true,
      contract: {
        select: {
          id: true,
          contractNo: true,
          vatPct: true,
          payMonthlyPct: true,
          payAsbuiltPct: true,
          payHandoverPct: true,
          planningPayPct: true,
          taxPct: true,
          items: {
            orderBy: [{ sortOrder: "asc" }, { itemNo: "asc" }],
            select: { id: true, itemNo: true, isGroup: true, description: true, unit: true, unitPrice: true, workType: true },
          },
        },
      },
      project: {
        select: {
          name: true,
          type: { select: { id: true, name: true } },
          central: {
            select: {
              name: true,
              dept: { select: { name: true, generalDept: { select: { name: true, sector: { select: { name: true, presidency: { select: { name: true } } } } } } } },
            },
          },
        },
      },
      sites: { orderBy: { code: "asc" }, select: { id: true, code: true, name: true } },
      materials: { select: { materialId: true, plannedQty: true } },
    },
  });
}
export type AoWorkspaceRow = NonNullable<Awaited<ReturnType<typeof findAoWorkspace>>>;

export function listMaterialCatalog() {
  return prisma.material.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, description: true, unit: true } });
}

export function listDocTypes() {
  return prisma.docType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** أكبر رقم تسلسل للمستخلصات على أمر التكليف */
export async function maxSeqOnAo(aoId: string, excludeId: string | null): Promise<number> {
  const r = await prisma.invoice.aggregate({ where: { aoId, ...(excludeId ? { id: { not: excludeId } } : {}) }, _max: { seq: true } });
  return r._max.seq ?? 0;
}

export function findInvoiceNoOnContract(contractId: string, invoiceNo: string) {
  return prisma.invoice.findUnique({ where: { contractId_invoiceNo: { contractId, invoiceNo } }, select: { id: true } });
}

/** المسودة (أو المستخلص المعاد للمقاول) بآخر نسخة — للمعالج والمرفقات */
export function findCompanyInvoice(id: string, companyIds: string[]) {
  return prisma.invoice.findFirst({
    where: { id, contract: { companyId: { in: companyIds } } },
    select: {
      id: true,
      invoiceNo: true,
      seq: true,
      aoId: true,
      contractId: true,
      pathName: true,
      period: true,
      workTypeId: true,
      status: true,
      returnTo: true,
      log: { where: { action: "return" }, orderBy: { at: "desc" }, take: 1, select: { at: true } },
      revisions: {
        orderBy: { n: "desc" },
        take: 1,
        select: {
          id: true,
          n: true,
          createdAt: true,
          lines: { orderBy: { sort: "asc" }, select: { qty: true, contractItem: { select: { itemNo: true } }, site: { select: { code: true } } } },
          materials: { select: { executedQty: true, material: { select: { code: true } } } },
          attachments: { orderBy: { uploadedAt: "asc" }, select: { id: true, fileName: true, size: true, uploadedAt: true, docTypeId: true } },
        },
      },
    },
  });
}
export type CompanyInvoice = NonNullable<Awaited<ReturnType<typeof findCompanyInvoice>>>;

export type DraftWrite = {
  aoId: string;
  contractId: string;
  invoiceNo: string;
  seq: number;
  pathName: string;
  period: string | null;
  workTypeId: string;
  lines: { contractItemId: string; qty: number; siteId: string | null; sort: number }[];
  materials: { materialId: string; executedQty: number }[];
};

/** إنشاء مسودة جديدة (نسخة 1) أو تحديث بنود ومهمات آخر نسخة لمسودة موجودة — المرفقات بتفضل زي ما هي */
export function upsertDraft(id: string | null, d: DraftWrite, userId: string, audit: { action: string; details: Prisma.InputJsonValue }) {
  return prisma.$transaction(async (tx) => {
    const fields = {
      aoId: d.aoId,
      contractId: d.contractId,
      invoiceNo: d.invoiceNo,
      seq: d.seq,
      pathName: d.pathName,
      period: d.period,
      workTypeId: d.workTypeId,
    };
    let invoiceId = id;
    let revisionId: string;
    if (!invoiceId) {
      const inv = await tx.invoice.create({
        data: { ...fields, status: "draft", createdById: userId, revisions: { create: { n: 1, createdById: userId } } },
        select: { id: true, revisions: { select: { id: true } } },
      });
      invoiceId = inv.id;
      revisionId = inv.revisions[0]!.id;
    } else {
      const res = await tx.invoice.updateMany({ where: { id: invoiceId, status: "draft" }, data: { ...fields, since: new Date() } });
      if (res.count !== 1) throw new Error("not a draft");
      const rev = await tx.invoiceRevision.findFirstOrThrow({ where: { invoiceId }, orderBy: { n: "desc" }, select: { id: true } });
      revisionId = rev.id;
      await tx.invoiceLine.deleteMany({ where: { revisionId } });
      await tx.invoiceMaterial.deleteMany({ where: { revisionId } });
    }
    if (d.lines.length) await tx.invoiceLine.createMany({ data: d.lines.map((l) => ({ ...l, revisionId })) });
    if (d.materials.length) await tx.invoiceMaterial.createMany({ data: d.materials.map((m) => ({ ...m, revisionId })) });
    await tx.auditLog.create({ data: { userId, action: audit.action, entity: "invoice", entityId: invoiceId, details: audit.details } });
    return invoiceId;
  });
}

/** استبدال بنود/مهمات نسخة مفتوحة لمستخلص معاد للمقاول (المقاول بيعدّل قبل إعادة التقديم) */
export function replaceRevisionContent(revisionId: string, lines: DraftWrite["lines"] | null, materials: DraftWrite["materials"] | null) {
  return prisma.$transaction(async (tx) => {
    if (lines) {
      await tx.invoiceLine.deleteMany({ where: { revisionId } });
      if (lines.length) await tx.invoiceLine.createMany({ data: lines.map((l) => ({ ...l, revisionId })) });
    }
    if (materials) {
      await tx.invoiceMaterial.deleteMany({ where: { revisionId } });
      if (materials.length) await tx.invoiceMaterial.createMany({ data: materials.map((m) => ({ ...m, revisionId })) });
    }
  });
}

export function deleteDraft(id: string) {
  return prisma.invoice.deleteMany({ where: { id, status: "draft" } });
}
