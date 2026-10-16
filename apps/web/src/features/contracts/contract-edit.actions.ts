"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { isAppError, toArabicMessage, type ActionState } from "@/lib/errors";
import { contractEditSchema } from "./contract-edit.schema";
import { updateContractTerms } from "./contract-edit.service";

export async function updateContractAction(contractId: string, input: unknown): Promise<ActionState> {
  try {
    const user = await requireUser();
    const n = await updateContractTerms(user, z.string().min(1).max(64).parse(contractId), contractEditSchema.parse(input));
    refresh();
    return { ok: true, message: n ? `تم حفظ بيانات العقد (${n} حقل)` : "لا توجد تعديلات للحفظ" };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, message: e.issues[0]?.message ?? "يرجى مراجعة البيانات" };
    if (!isAppError(e)) console.error("[contract:update]", e);
    return { ok: false, message: toArabicMessage(e) };
  }
}
