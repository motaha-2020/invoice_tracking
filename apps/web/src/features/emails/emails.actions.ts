"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { isAppError, toArabicMessage, type ActionState } from "@/lib/errors";
import { requeueFailed } from "./emails.service";

export async function requeueAction(ids: string[] | "allFailed"): Promise<ActionState> {
  const user = await requireUser();
  try {
    const parsed = ids === "allFailed" ? ids : z.array(z.string().min(1).max(64)).max(500).parse(ids);
    const n = await requeueFailed(user, parsed);
    refresh();
    return { ok: true, message: n ? `أُعيدت ${n} رسالة إلى قائمة الإرسال` : "لا توجد رسائل متعذّرة الإرسال" };
  } catch (e) {
    if (!isAppError(e)) console.error("[emails:requeue]", e);
    return { ok: false, message: toArabicMessage(e) };
  }
}
