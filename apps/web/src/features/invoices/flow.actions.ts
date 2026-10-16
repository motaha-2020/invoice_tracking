"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { isAppError, toArabicMessage, type ActionState } from "@/lib/errors";
import { actCommandSchema } from "./flow.schema";
import { act } from "./flow.service";

/** أي حركة على المستخلص: تحقق ← act() ← refresh ← رسالة عربي */
export async function actAction(invoiceId: string, input: unknown): Promise<ActionState> {
  const user = await requireUser();
  try {
    const id = z.string().min(1).max(64).parse(invoiceId);
    const cmd = actCommandSchema.parse(input);
    const res = await act(user, id, cmd);
    refresh();
    return { ok: true, message: res.message };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, message: e.issues[0]?.message ?? "يرجى مراجعة البيانات" };
    if (!isAppError(e)) console.error("[invoice:act]", e);
    return { ok: false, message: toArabicMessage(e) };
  }
}
