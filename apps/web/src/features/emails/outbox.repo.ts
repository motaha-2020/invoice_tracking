import "server-only";
import { prisma, type EmailStatus, type Prisma } from "@it/db";

/** صندوق البريد الصادر (email_outbox) — الطبقة الوحيدة هنا اللي بتكلم DB */

export const MAX_ATTEMPTS = 5;

export type OutboxRow = { id: string; toEmail: string; toName: string | null; subject: string; body: string; attempts: number };

/**
 * يحجز دفعة رسائل للإرسال: pending، وعدت فترة الانتظار بعد آخر محاولة (attempts² دقيقة).
 * FOR UPDATE SKIP LOCKED + زيادة attempts في نفس الأمر = نسختين من الخدمة ما يبعتوش نفس الرسالة.
 */
export function claimBatch(limit: number): Promise<OutboxRow[]> {
  return prisma.$queryRaw<OutboxRow[]>`
    UPDATE email_outbox SET attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM email_outbox
      WHERE status = 'pending' AND attempts < ${MAX_ATTEMPTS}
        AND created_at + make_interval(mins => attempts * attempts) <= now()
      ORDER BY created_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, to_email AS "toEmail", to_name AS "toName", subject, body, attempts`;
}

export function markSent(id: string) {
  return prisma.emailOutbox.update({ where: { id }, data: { status: "sent", sentAt: new Date(), lastError: null }, select: { id: true } });
}

export function markFailed(id: string, error: string, final: boolean) {
  return prisma.emailOutbox.update({ where: { id }, data: { lastError: error.slice(0, 500), ...(final ? { status: "failed" as const } : {}) }, select: { id: true } });
}

export function listOutbox(where: Prisma.EmailOutboxWhereInput, take = 200) {
  return prisma.emailOutbox.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true, toEmail: true, toName: true, subject: true, body: true, status: true, attempts: true, lastError: true, createdAt: true, sentAt: true,
      invoice: { select: { id: true, invoiceNo: true } },
    },
  });
}

export async function countByStatus(): Promise<Partial<Record<EmailStatus, number>>> {
  const rows = await prisma.emailOutbox.groupBy({ by: ["status"], _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
}

/** إعادة المحاولة: الفاشلة ترجع pending بعداد صفر */
export function requeue(ids: string[] | "allFailed", userId: string) {
  return prisma.$transaction(async (tx) => {
    const where: Prisma.EmailOutboxWhereInput = ids === "allFailed" ? { status: "failed" } : { id: { in: ids }, status: "failed" };
    const res = await tx.emailOutbox.updateMany({ where, data: { status: "pending", attempts: 0, lastError: null } });
    await tx.auditLog.create({ data: { userId, action: "email.requeue", entity: "email_outbox", details: { count: res.count } } });
    return res.count;
  });
}
