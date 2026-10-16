"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { isAppError, toArabicMessage, type ActionState } from "@/lib/errors";
import { smtpSchema } from "./smtp.schema";
import { saveSmtp, sendTestEmail } from "./smtp.service";

export async function saveSmtpAction(input: unknown): Promise<ActionState> {
  try {
    const user = await requireUser();
    const v = smtpSchema.parse(input);
    await saveSmtp(user, v);
    refresh();
    return { ok: true, message: v.host ? "تم حفظ إعدادات خادم البريد — يُفضَّل إرسال رسالة تجريبية للتأكد" : "تم إيقاف الإرسال من إعدادات الشاشة" };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, message: e.issues[0]?.message ?? "يرجى مراجعة البيانات" };
    if (!isAppError(e)) console.error("[smtp:save]", e);
    return { ok: false, message: toArabicMessage(e) };
  }
}

export async function testSmtpAction(): Promise<ActionState> {
  try {
    const user = await requireUser();
    const to = await sendTestEmail(user);
    return { ok: true, message: `أُرسلت رسالة تجريبية إلى ${to} — تحقق من صندوق الوارد (وصندوق الرسائل غير المرغوب فيها)` };
  } catch (e) {
    if (!isAppError(e)) console.error("[smtp:test]", e);
    return { ok: false, message: toArabicMessage(e) };
  }
}
