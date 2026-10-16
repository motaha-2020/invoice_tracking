import "server-only";
import { prisma, type Prisma } from "@it/db";

/** تعديل وحذف السجلات — الطبقة الوحيدة هنا اللي بتكلم DB. كل كتابة معاها سطر في audit_log */
type Audit = { userId: string; action: string; entity: string; entityId: string; details?: Prisma.InputJsonValue };
type Tx = Prisma.TransactionClient;

const audit = (tx: Tx, a: Audit) => tx.auditLog.create({ data: a });

// ── القراءة ──
export const findContract = (id: string) =>
  prisma.contract.findUnique({ where: { id }, select: { id: true, contractNo: true, _count: { select: { invoices: true, assignmentOrders: true } } } });

export const findAo = (id: string) =>
  prisma.assignmentOrder.findUnique({
    where: { id },
    select: {
      id: true, contractId: true, aoNo: true, aoDate: true, status: true, name: true, projectId: true, value: true, financialCommitment: true,
      planningAnnexValue: true, stampsTotal: true, finalGuaranteePct: true, area: true, centralText: true, outOfScope: true, duration: true,
      _count: { select: { invoices: true } },
    },
  });

export const findContractItem = (id: string) =>
  prisma.contractItem.findUnique({
    where: { id },
    select: {
      id: true, contractId: true, itemNo: true, unit: true, isGroup: true, description: true, contractQty: true, unitPrice: true, workType: true,
      _count: { select: { aoItems: true, invoiceLines: true } },
    },
  });

export const findAoItem = (id: string) =>
  prisma.aoItem.findUnique({ where: { id }, select: { id: true, aoId: true, plannedQty: true, contractItem: { select: { itemNo: true } }, ao: { select: { aoNo: true, contractId: true } } } });

export const findInvoice = (id: string) =>
  prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true, contractId: true, invoiceNo: true, period: true, pathName: true, workTypeId: true, migrated: true, migratedAmount: true,
      status: true, currentStep: true, heldAt: true, paymentRef: true,
    },
  });

export const listProjectOptions = () => prisma.project.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: "asc" } });
export const listWorkTypeOptions = () => prisma.workType.findMany({ select: { id: true, name: true }, orderBy: { sort: "asc" } });

// ── التعديل ──
export function updateAo(id: string, data: Prisma.AssignmentOrderUncheckedUpdateInput, a: Audit) {
  return prisma.$transaction(async (tx) => {
    await tx.assignmentOrder.update({ where: { id }, data, select: { id: true } });
    await audit(tx, a);
  });
}

export function updateContractItem(id: string, data: Prisma.ContractItemUncheckedUpdateInput, a: Audit) {
  return prisma.$transaction(async (tx) => {
    await tx.contractItem.update({ where: { id }, data, select: { id: true } });
    await audit(tx, a);
  });
}

export function updateAoItem(id: string, plannedQty: number, a: Audit) {
  return prisma.$transaction(async (tx) => {
    await tx.aoItem.update({ where: { id }, data: { plannedQty }, select: { id: true } });
    await audit(tx, a);
  });
}

export type StageLog = { toStep: string | null; note: string; byId: string; action: "approve" | "pay" | "hold" };

export function updateInvoice(id: string, data: Prisma.InvoiceUncheckedUpdateInput, a: Audit, log: StageLog | null) {
  return prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id }, data, select: { id: true } });
    if (log) await tx.stepLog.create({ data: { invoiceId: id, action: log.action, toStep: log.toStep, note: log.note, byId: log.byId } });
    await audit(tx, a);
  });
}

// ── الحذف (الملفات على القرص بترجع للـ service يمسحها بعد نجاح الـ transaction) ──
async function aoFilePaths(tx: Tx, aoIds: string[]) {
  return (await tx.contractAttachment.findMany({ where: { aoId: { in: aoIds } }, select: { storagePath: true } })).map((f) => f.storagePath);
}

export function deleteAo(id: string, a: Audit): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const files = await aoFilePaths(tx, [id]);
    await tx.assignmentOrder.delete({ where: { id } });
    await audit(tx, a);
    return files;
  });
}

/** العقد ← أوامر التكليف (وتوابعها) ← البنود والمرفقات (cascade) */
export function deleteContract(id: string, a: Audit): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const files = (await tx.contractAttachment.findMany({ where: { contractId: id }, select: { storagePath: true } })).map((f) => f.storagePath);
    await tx.assignmentOrder.deleteMany({ where: { contractId: id } });
    await tx.contract.delete({ where: { id } });
    await audit(tx, a);
    return files;
  }, { timeout: 60_000 });
}

export function deleteContractItem(id: string, a: Audit) {
  return prisma.$transaction(async (tx) => {
    await tx.contractItem.delete({ where: { id } });
    await audit(tx, a);
  });
}

export function deleteAoItem(id: string, a: Audit) {
  return prisma.$transaction(async (tx) => {
    await tx.aoItem.delete({ where: { id } });
    await audit(tx, a);
  });
}

export function deleteInvoice(id: string, a: Audit): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const files = (await tx.attachment.findMany({ where: { revision: { invoiceId: id } }, select: { storagePath: true } })).map((f) => f.storagePath);
    await tx.invoice.delete({ where: { id } });
    await audit(tx, a);
    return files;
  });
}
