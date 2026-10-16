import "server-only";
import { prisma, type Prisma } from "@it/db";
import { cloneLatestRevision } from "./flow.repo";

export function findAttachment(id: string, invoiceWhere: Prisma.InvoiceWhereInput) {
  return prisma.attachment.findFirst({
    where: { id, revision: { invoice: invoiceWhere } },
    select: {
      id: true,
      fileName: true,
      storagePath: true,
      mimeType: true,
      size: true,
      revisionId: true,
      revision: { select: { invoiceId: true } },
    },
  });
}

export function insertAttachment(data: Prisma.AttachmentUncheckedCreateInput, audit: { userId: string; invoiceId: string }) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.attachment.create({ data, select: { id: true, fileName: true, size: true, uploadedAt: true, docTypeId: true } });
    await tx.auditLog.create({ data: { userId: audit.userId, action: "attachment.upload", entity: "invoice", entityId: audit.invoiceId, details: { file: data.fileName, size: data.size } } });
    return a;
  });
}

/** حذف صف المرفق، وبيرجع عدد الصفوف الباقية اللي بتشاور على نفس الملف (النسخ بتشارك الملفات) */
export function deleteAttachmentRow(id: string, storagePath: string, audit: { userId: string; invoiceId: string; fileName: string }) {
  return prisma.$transaction(async (tx) => {
    await tx.attachment.delete({ where: { id } });
    await tx.auditLog.create({ data: { userId: audit.userId, action: "attachment.delete", entity: "invoice", entityId: audit.invoiceId, details: { file: audit.fileName } } });
    return tx.attachment.count({ where: { storagePath } });
  });
}

export function docTypeExists(id: string) {
  return prisma.docType.count({ where: { id } });
}

export function storagePathsOfInvoice(invoiceId: string) {
  return prisma.attachment.findMany({ where: { revision: { invoiceId } }, select: { storagePath: true } });
}

export function countStoragePathRefs(paths: string[]) {
  return prisma.attachment.groupBy({ by: ["storagePath"], where: { storagePath: { in: paths } }, _count: { _all: true } });
}

export function openNewRevision(invoiceId: string, userId: string, note: string) {
  return prisma.$transaction((tx) => cloneLatestRevision(tx, invoiceId, userId, note));
}

export function findAttachmentByPath(revisionId: string, storagePath: string) {
  return prisma.attachment.findFirst({ where: { revisionId, storagePath }, select: { id: true, fileName: true, storagePath: true } });
}

export function auditInvoice(userId: string, invoiceId: string, action: string, details: Prisma.InputJsonValue) {
  return prisma.auditLog.create({ data: { userId, action, entity: "invoice", entityId: invoiceId, details }, select: { id: true } });
}

export function latestRevisionOfPaid(invoiceId: string, invoiceWhere: Prisma.InvoiceWhereInput) {
  return prisma.invoiceRevision.findFirst({
    where: { invoice: { AND: [{ id: invoiceId, status: "paid" }, invoiceWhere] } },
    orderBy: { n: "desc" },
    select: { id: true },
  });
}
