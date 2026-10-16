"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/features/auth/session";
import { toArabicMessage } from "@/lib/errors";
import { commitImport, previewImport, type PreviewSummary } from "./import.service";

export type PreviewState = { ok: boolean; message?: string; preview?: PreviewSummary };
export type CommitState = { ok: boolean; message?: string };

/** رفع ملف القالب ← معاينة (بدون حفظ) */
export async function previewImportAction(_prev: PreviewState, form: FormData): Promise<PreviewState> {
  try {
    const user = await requireUser();
    const templateId = String(form.get("templateId") ?? "");
    const file = form.get("file");
    if (!(file instanceof File)) return { ok: false, message: "يرجى اختيار ملف أولاً" };
    const preview = await previewImport(templateId, file, { user });
    return { ok: true, preview };
  } catch (e) {
    return { ok: false, message: toArabicMessage(e) };
  }
}

/** تأكيد الحفظ بعد المعاينة */
export async function commitImportAction(_prev: CommitState, form: FormData): Promise<CommitState> {
  try {
    const user = await requireUser();
    const result = await commitImport(String(form.get("batchId") ?? ""), { user });
    refresh();
    return { ok: true, message: result.message };
  } catch (e) {
    return { ok: false, message: toArabicMessage(e) };
  }
}
