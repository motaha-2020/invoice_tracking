import "server-only";
import { prisma } from "@it/db";

export function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export function listRecent(userId: string, take = 15) {
  return prisma.notification.findMany({
    where: { userId },
    select: { id: true, title: true, invoiceId: true, readAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export function markAllRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
