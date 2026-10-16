import "server-only";
import { prisma, type InvoiceStatus, type Prisma, type StepAction } from "@it/db";

/**
 * كتابة حركة على المستخلص — كله في transaction واحدة:
 * حالة المستخلص + سطر في step_log (والأسباب) + audit + الإشعارات + الإيميلات (email_outbox).
 *
 * الحماية من التعارض: التحديث مشروط بإن الحالة والمرحلة لسه زي ما اتقرت. لو حد تاني حرّك
 * المستخلص في نفس اللحظة، العدد بيبقى 0 وبنرجع false (الـ service بيحولها لـ CONFLICT).
 */

export type Tx = Prisma.TransactionClient;

export type FlowWrite = {
  invoiceId: string;
  expect: { status: InvoiceStatus; currentStep: string | null };
  data: Prisma.InvoiceUpdateManyMutationInput;
  log: {
    action: StepAction;
    fromStep: string | null;
    toStep: string | null;
    category?: string | null;
    note: string | null;
    onBehalf: boolean;
    byId: string;
    reasonIds?: readonly string[];
  };
  audit: { userId: string; action: string; details?: Prisma.InputJsonValue };
  notifications: { userId: string; title: string }[];
  emails: { toEmail: string; toName: string; subject: string; body: string }[];
  /** خطوات إضافية جوه نفس الـ transaction (نسخة جديدة، تعديل كمية …) — بتشتغل بعد التحقق من الحالة */
  extra?: (tx: Tx) => Promise<void>;
};

export async function writeFlow(w: FlowWrite): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const res = await tx.invoice.updateMany({
      where: { id: w.invoiceId, status: w.expect.status, currentStep: w.expect.currentStep },
      data: w.data,
    });
    if (res.count !== 1) return false;
    if (w.extra) await w.extra(tx);
    await tx.stepLog.create({
      data: {
        invoiceId: w.invoiceId,
        action: w.log.action,
        fromStep: w.log.fromStep,
        toStep: w.log.toStep,
        category: w.log.category ?? null,
        note: w.log.note,
        onBehalf: w.log.onBehalf,
        byId: w.log.byId,
        reasons: w.log.reasonIds?.length ? { create: w.log.reasonIds.map((reasonId) => ({ reasonId })) } : undefined,
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: { userId: w.audit.userId, action: w.audit.action, entity: "invoice", entityId: w.invoiceId, details: w.audit.details },
    });
    if (w.notifications.length) {
      await tx.notification.createMany({ data: w.notifications.map((n) => ({ ...n, invoiceId: w.invoiceId })) });
    }
    if (w.emails.length) {
      await tx.emailOutbox.createMany({ data: w.emails.map((e) => ({ ...e, invoiceId: w.invoiceId, status: "pending" as const })) });
    }
    return true;
  });
}

/** نسخة جديدة = نسخة من آخر نسخة (البنود والمهمات والمرفقات) — للإعادة بعد الاستيفاء */
export async function cloneLatestRevision(tx: Tx, invoiceId: string, createdById: string, note: string | null): Promise<string> {
  const last = await tx.invoiceRevision.findFirstOrThrow({
    where: { invoiceId },
    orderBy: { n: "desc" },
    select: {
      n: true,
      lines: { select: { contractItemId: true, newItemNo: true, newDescription: true, newUnit: true, agreedPrice: true, siteId: true, qty: true, approvedQty: true, approveNote: true, sort: true } },
      materials: { select: { materialId: true, executedQty: true, billedQty: true } },
      attachments: { select: { docTypeId: true, fileName: true, storagePath: true, mimeType: true, size: true, sha256: true, uploadedById: true, uploadedAt: true } },
    },
  });
  const rev = await tx.invoiceRevision.create({
    data: {
      invoiceId,
      n: last.n + 1,
      note,
      createdById,
      lines: { create: last.lines },
      materials: { create: last.materials },
      attachments: { create: last.attachments },
    },
    select: { id: true },
  });
  return rev.id;
}

/** آخر نسخة (id + رقم + تاريخ) */
export function latestRevision(invoiceId: string) {
  return prisma.invoiceRevision.findFirst({ where: { invoiceId }, orderBy: { n: "desc" }, select: { id: true, n: true, createdAt: true } });
}

/** تعديل الكمية المعتمدة لبند (في آخر نسخة) */
export async function setApprovedQty(tx: Tx, lineId: string, revisionId: string, qty: Prisma.Decimal | number, note: string): Promise<void> {
  const res = await tx.invoiceLine.updateMany({ where: { id: lineId, revisionId }, data: { approvedQty: qty, approveNote: note } });
  if (res.count !== 1) throw new Error("line not in latest revision");
}
