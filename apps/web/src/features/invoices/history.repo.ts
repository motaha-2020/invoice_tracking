import "server-only";
import { prisma, type InvoiceStatus, type Prisma } from "@it/db";

/** ترحيل المستخلصات (قالب 11) — القراءة للفحص والكتابة جوه transaction الاستيراد */
type Tx = Prisma.TransactionClient;

export function listContractsForHistory() {
  return prisma.contract.findMany({ select: { id: true, contractNo: true } });
}

export function listAosForHistory(contractIds: string[]) {
  return prisma.assignmentOrder.findMany({
    where: { contractId: { in: contractIds } },
    select: { id: true, contractId: true, aoNo: true, status: true },
  });
}

export function listWorkTypesForHistory() {
  return prisma.workType.findMany({ select: { id: true, code: true } });
}

export function listExistingInvoices(contractIds: string[], invoiceNos: string[]) {
  return prisma.invoice.findMany({
    where: { contractId: { in: contractIds }, invoiceNo: { in: invoiceNos } },
    select: { id: true, contractId: true, invoiceNo: true, aoId: true, migrated: true, status: true, currentStep: true, since: true, paymentRef: true },
  });
}

export function findInvoiceByNo(tx: Tx, contractId: string, invoiceNo: string) {
  return tx.invoice.findUnique({
    where: { contractId_invoiceNo: { contractId, invoiceNo } },
    select: { id: true, migrated: true, status: true, currentStep: true },
  });
}

/** أمر تكليف لسه ما اتسجلش (المستخلص مستنيه) — بيتعمل pending_approval لحد ما الشئون الفنية ترفعه */
export async function ensurePendingAo(tx: Tx, contractId: string, aoNo: string, name: string): Promise<{ id: string; created: boolean }> {
  const ex = await tx.assignmentOrder.findUnique({ where: { contractId_aoNo: { contractId, aoNo } }, select: { id: true } });
  if (ex) return { id: ex.id, created: false };
  const ao = await tx.assignmentOrder.create({
    data: { contractId, aoNo, name, status: "pending_approval", sourceNote: "أُنشئ تلقائياً من ترحيل المستخلصات (النموذج 11) — بانتظار استكمال بيانات أمر التكليف" },
    select: { id: true },
  });
  return { id: ao.id, created: true };
}

export type MigratedFields = {
  status: InvoiceStatus;
  currentStep: string | null;
  heldAt: string | null;
  holdReason: string | null;
  category: string | null;
  since: Date;
  paidAt: Date | null;
  paymentRef: string | null;
};

export type LogEntry = { action: "submit" | "pay" | "approve"; toStep: string | null; note: string; at: Date; byId: string };

export function createMigratedInvoice(
  tx: Tx,
  d: MigratedFields & {
    contractId: string;
    aoId: string;
    invoiceNo: string;
    pathName: string;
    workTypeId: string | null;
    migratedAmount: number;
    paymentAmount: number | null;
    submittedAt: Date | null;
    createdById: string;
  },
  log: LogEntry,
) {
  return tx.invoice.create({
    data: {
      ...d,
      migrated: true,
      log: { create: { action: log.action, fromStep: null, toStep: log.toStep, note: log.note, at: log.at, byId: log.byId } },
    },
    select: { id: true },
  });
}

export function updateMigratedStatus(tx: Tx, id: string, d: Partial<MigratedFields>, log: LogEntry | null) {
  return tx.invoice.update({
    where: { id },
    data: { ...d, ...(log ? { log: { create: { action: log.action, toStep: log.toStep, note: log.note, at: log.at, byId: log.byId } } } : {}) },
    select: { id: true },
  });
}
