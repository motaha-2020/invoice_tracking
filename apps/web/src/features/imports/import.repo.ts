import "server-only";
import { prisma, type Prisma } from "@it/db";

export function createBatch(data: { templateId: string; fileName: string; userId: string; rows: number; report: Prisma.InputJsonValue }) {
  return prisma.importBatch.create({ data: { ...data, status: "preview" } });
}

export function findBatch(id: string) {
  return prisma.importBatch.findUnique({ where: { id } });
}

export function listBatches(templateId?: string, take = 20) {
  return prisma.importBatch.findMany({
    where: templateId ? { templateId, status: { not: "preview" } } : { status: { not: "preview" } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export function markBatch(tx: Prisma.TransactionClient, id: string, status: string, report: Prisma.InputJsonValue) {
  return tx.importBatch.update({ where: { id }, data: { status, report } });
}
