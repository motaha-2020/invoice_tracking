"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { isAppError, toArabicMessage, type ActionState } from "@/lib/errors";
import { renewCommitment } from "./commitment.service";

export async function renewCommitmentAction(aoId: string, input: unknown): Promise<ActionState> {
  const user = await requireUser();
  try {
    const data = z
      .object({
        newTotal: z.number("يرجى إدخال قيمة الارتباط الجديدة").finite().positive("يرجى إدخال قيمة الارتباط الجديدة").max(1e13),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "يرجى اختيار تاريخ الخطاب"),
        reference: z.string().trim().min(1, "يرجى إدخال رقم خطاب التعزيز").max(120),
        note: z.string().trim().max(500).optional(),
      })
      .parse(input);
    await renewCommitment(user, z.string().min(1).max(64).parse(aoId), data);
    refresh();
    return { ok: true, message: "تم تسجيل تعزيز الارتباط المالي" };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, message: e.issues[0]?.message ?? "يرجى مراجعة البيانات" };
    if (!isAppError(e)) console.error("[commitment]", e);
    return { ok: false, message: toArabicMessage(e) };
  }
}
