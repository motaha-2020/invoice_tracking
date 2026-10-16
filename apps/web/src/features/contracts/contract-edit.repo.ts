import "server-only";
import { prisma, type Prisma } from "@it/db";

/** تعديل بيانات العقد ومرفقاته — الطبقة الوحيدة هنا اللي بتكلم DB */

type Audit = { userId: string; action: string; entity: string; entityId?: string; details?: Prisma.InputJsonValue };

export function updateContract(id: string, data: Prisma.ContractUpdateInput, audit: Audit) {
  return prisma.$transaction([prisma.contract.update({ where: { id }, data, select: { id: true } }), prisma.auditLog.create({ data: audit })]);
}

export function findContractForEdit(id: string, where: Prisma.ContractWhereInput) {
  return prisma.contract.findFirst({ where: { AND: [{ id }, where] } });
}

/** aoId = null ← مرفقات العقد نفسه، وغير كده مرفقات أمر التكليف */
export function listContractFiles(contractId: string, aoId: string | null) {
  return prisma.contractAttachment.findMany({
    where: { contractId, aoId },
    select: { id: true, kind: true, note: true, fileName: true, size: true, uploadedAt: true, uploadedById: true },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function uploaderNames(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return new Map(rows.map((r) => [r.id, r.name]));
}

export function insertContractFile(data: Prisma.ContractAttachmentUncheckedCreateInput, audit: Audit) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.contractAttachment.create({ data, select: { id: true } });
    await tx.auditLog.create({ data: { ...audit, entityId: data.contractId } });
    return a;
  });
}

export function findContractFile(id: string, contractWhere: Prisma.ContractWhereInput) {
  return prisma.contractAttachment.findFirst({
    where: { id, contract: contractWhere },
    select: { id: true, contractId: true, aoId: true, fileName: true, storagePath: true, mimeType: true, kind: true },
  });
}

export function findAoOfContract(contractId: string, aoId: string) {
  return prisma.assignmentOrder.findFirst({ where: { id: aoId, contractId }, select: { id: true, aoNo: true } });
}

export function deleteContractFile(id: string, audit: Audit) {
  return prisma.$transaction([prisma.contractAttachment.delete({ where: { id } }), prisma.auditLog.create({ data: audit })]);
}
