import "server-only";
import type { SessionUser } from "@/features/auth/auth.types";
import { can } from "@/features/auth/permissions";
import { AppError } from "@/lib/errors";
import { addCommitmentRenewal, findAoForCommitment } from "./commitment.repo";

/**
 * تعزيز الارتباط المالي لأمر التكليف (خطاب تعزيز). ده اللي بيفك قفل السداد لما المفوتر يتجاوز الارتباط.
 * نفس صلاحية استيراد العقود وأوامر التكليف.
 */
export async function renewCommitment(user: SessionUser, aoId: string, input: { newTotal: number; date: string; reference: string; note?: string }) {
  if (!(await can(user, "master.import"))) throw new AppError("FORBIDDEN");
  const ao = await findAoForCommitment(aoId);
  if (!ao) throw new AppError("NOT_FOUND");
  const before = ao.financialCommitment == null ? null : Number(ao.financialCommitment);
  if (before != null && input.newTotal <= before) throw new AppError("VALIDATION", "يجب أن تكون قيمة الارتباط الجديدة أكبر من الارتباط الحالي");
  const d = new Date(`${input.date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new AppError("VALIDATION", "تاريخ الخطاب غير صحيح");
  await addCommitmentRenewal(
    ao.id,
    { changeDate: d, baseValue: before, newTotal: input.newTotal, reference: input.reference.trim(), note: input.note?.trim() || null },
    { userId: user.id, details: { ao: ao.aoNo, from: before, to: input.newTotal, reference: input.reference } },
  );
}
