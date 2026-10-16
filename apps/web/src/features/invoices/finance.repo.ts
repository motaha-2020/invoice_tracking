import "server-only";
import { prisma, type Prisma } from "@it/db";

/** المبالغ المحتجزة (صفوف invoice_deductions القابلة للصرف) — النطاق بييجي جاهز من الـ service */

const retentionSelect = {
  id: true,
  type: true,
  name: true,
  pct: true,
  amount: true,
  releasedAt: true,
  releaseRef: true,
  releaseMethod: true,
  releaseNote: true,
  releasedBy: { select: { name: true } },
  invoice: {
    select: {
      id: true,
      invoiceNo: true,
      pathName: true,
      paidAt: true,
      contract: { select: { contractNo: true, company: { select: { id: true, name: true } } } },
      ao: { select: { aoNo: true } },
    },
  },
} satisfies Prisma.InvoiceDeductionSelect;

export type RetentionRow = Prisma.InvoiceDeductionGetPayload<{ select: typeof retentionSelect }>;

export function listRetentions(invoiceWhere: Prisma.InvoiceWhereInput, filter: { released?: boolean; type?: "asbuilt" | "handover" }) {
  return prisma.invoiceDeduction.findMany({
    where: {
      releasable: true,
      invoice: { AND: [invoiceWhere, { status: "paid" }] },
      ...(filter.released === undefined ? {} : { releasedAt: filter.released ? { not: null } : null }),
      ...(filter.type ? { type: filter.type } : {}),
    },
    orderBy: [{ invoice: { paidAt: "asc" } }, { type: "asc" }],
    take: 500,
    select: retentionSelect,
  });
}

export function findRetention(id: string, invoiceWhere: Prisma.InvoiceWhereInput) {
  return prisma.invoiceDeduction.findFirst({
    where: { id, releasable: true, invoice: { AND: [invoiceWhere, { status: "paid" }] } },
    select: { id: true, type: true, name: true, amount: true, releasedAt: true, invoiceId: true },
  });
}

/** أكواد أنواع المستندات المرفقة في كل نسخ المستخلص */
export async function attachedDocCodes(invoiceId: string): Promise<string[]> {
  const rows = await prisma.attachment.findMany({
    where: { revision: { invoiceId }, docTypeId: { not: null } },
    select: { docType: { select: { code: true } } },
    distinct: ["docTypeId"],
  });
  return rows.map((r) => r.docType!.code);
}

export function releaseRetentionTx(tx: Prisma.TransactionClient, id: string, data: { ref: string; method: string; note: string | null; at: Date; byId: string }) {
  return tx.invoiceDeduction.updateMany({
    where: { id, releasedAt: null },
    data: { releasedAt: data.at, releaseRef: data.ref, releaseMethod: data.method, releaseNote: data.note, releasedById: data.byId },
  });
}

/** استبدال الاستقطاعات المعدّلة (غير المحتجز) لمستخلص */
export async function replaceEditableDeductions(tx: Prisma.TransactionClient, invoiceId: string, rows: Omit<Prisma.InvoiceDeductionCreateManyInput, "invoiceId">[]) {
  await tx.invoiceDeduction.deleteMany({ where: { invoiceId, type: { in: ["tax", "penalty", "other"] } } });
  if (rows.length) await tx.invoiceDeduction.createMany({ data: rows.map((r) => ({ ...r, invoiceId })) });
}

export function docTypeIdsByCodes(codes: readonly string[]) {
  return prisma.docType.findMany({ where: { code: { in: [...codes] } }, select: { id: true, code: true, name: true } });
}
