import "server-only";
import type { Prisma } from "@it/db";
import type { CommitResult, ImportPreview } from "@/features/imports/import.types";
import { AppError, isAppError } from "@/lib/errors";

/**
 * حفظ الصفوف السليمة بالترتيب (الأب قبل الابن). لو صف وقع (مثلاً الأب اتمسح من ساعة المعاينة)
 * الـ transaction كلها بترجع، وبنطلّع رسالة عربي فيها رقم الصف.
 */
export async function commitRows<T>(
  preview: ImportPreview<T>,
  tx: Prisma.TransactionClient,
  write: (tx: Prisma.TransactionClient, data: T) => Promise<void>,
): Promise<CommitResult> {
  const counts = { create: 0, update: 0 };
  for (const r of preview.rows) {
    if (!r.data || (r.status !== "create" && r.status !== "update")) continue;
    try {
      await write(tx, r.data);
    } catch (e) {
      if (isAppError(e)) throw e;
      throw new AppError("CONFLICT", `تعذّر حفظ الصف ${r.row} في ورقة العمل "${r.sheet}" (${r.label}) — تغيرت البيانات منذ المراجعة. يرجى إعادة رفع الملف.`, { cause: e });
    }
    counts[r.status]++;
  }
  return { message: `تم حفظ ${counts.create} سجل جديد وتحديث ${counts.update} سجل`, counts };
}
