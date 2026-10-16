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
      throw new AppError("CONFLICT", `مقدرناش نحفظ صف ${r.row} في شيت "${r.sheet}" (${r.label}) — البيانات اتغيرت من ساعة المعاينة. ارفع الملف تاني.`, { cause: e });
    }
    counts[r.status]++;
  }
  return { message: `اتحفظ ${counts.create} جديد و${counts.update} تحديث`, counts };
}
