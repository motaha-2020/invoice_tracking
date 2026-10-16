"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/features/auth/session";
import { isAppError, toArabicMessage, type ActionState } from "@/lib/errors";
import { KIND_LABELS, isOrgKind } from "./org.kinds";
import { parseOrgInput } from "./org.schema";
import { createOrgEntity, deleteOrgEntity, updateOrgEntity } from "./org.service";

/** قيم الفورم النصية بس (من غير ملفات ولا حقول React الداخلية) */
function formValues(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}

/** إضافة (من غير id) أو تعديل (بـ id) — الكود بيتقرا في الإضافة بس */
export async function saveOrgEntityAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  // برّه الـ try: redirect بيشتغل بـ throw
  const user = await requireUser();
  const values = formValues(form);
  const kind = values.kind;
  if (!isOrgKind(kind)) return { ok: false, message: "نوع البيانات غير معروف", values };
  const id = values.id?.trim() || null;

  const parsed = parseOrgInput(kind, values, id === null);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, values };

  try {
    if (id) await updateOrgEntity(user, id, parsed.data);
    else await createOrgEntity(user, parsed.data, parsed.code!);
  } catch (e) {
    if (!isAppError(e)) console.error("[org.save]", e);
    return { ok: false, message: toArabicMessage(e), values };
  }
  refresh();
  const { one } = KIND_LABELS[kind];
  return { ok: true, message: id ? `تم تعديل ${one} «${parsed.data.fields.name}»` : `تمت إضافة ${one} «${parsed.data.fields.name}»` };
}

export async function deleteOrgEntityAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const kind = form.get("kind");
  const id = String(form.get("id") ?? "");
  if (!isOrgKind(kind) || !id) return { ok: false, message: "بيانات طلب الحذف غير مكتملة" };
  try {
    const rec = await deleteOrgEntity(user, kind, id);
    refresh();
    return { ok: true, message: `تم حذف ${KIND_LABELS[kind].one} «${rec.name}»` };
  } catch (e) {
    if (!isAppError(e)) console.error("[org.delete]", e);
    return { ok: false, message: toArabicMessage(e) };
  }
}
