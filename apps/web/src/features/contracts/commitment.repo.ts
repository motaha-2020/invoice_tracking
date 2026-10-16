import "server-only";
import { prisma, type Prisma } from "@it/db";

export function findAoForCommitment(aoId: string) {
  return prisma.assignmentOrder.findUnique({ where: { id: aoId }, select: { id: true, aoNo: true, value: true, financialCommitment: true, contractId: true } });
}

/** تعزيز الارتباط المالي: سطر في ملاحق أمر التكليف + القيمة الجديدة للارتباط — transaction واحدة */
export function addCommitmentRenewal(
  aoId: string,
  data: { changeDate: Date; baseValue: number | null; newTotal: number; reference: string; note: string | null },
  audit: { userId: string; details: Prisma.InputJsonValue },
) {
  return prisma.$transaction(async (tx) => {
    await tx.aoChange.create({
      data: {
        aoId,
        kind: "commitment_renewal",
        changeDate: data.changeDate,
        baseValue: data.baseValue,
        increase: data.baseValue == null ? null : data.newTotal - data.baseValue,
        newTotal: data.newTotal,
        reference: data.reference,
        note: data.note,
      },
    });
    await tx.assignmentOrder.update({ where: { id: aoId }, data: { financialCommitment: data.newTotal } });
    await tx.auditLog.create({ data: { userId: audit.userId, action: "ao.commitment.renew", entity: "assignment_order", entityId: aoId, details: audit.details } });
  });
}
