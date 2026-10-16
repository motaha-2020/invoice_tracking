"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { isAppError, toArabicMessage, type ActionState } from "@/lib/errors";
import { docTypeSchema, holidaySchema, isoDateSchema, reasonNameSchema, requiredDocSchema, settingsSchema, slaMatrixSchema } from "./workflow.schema";
import * as svc from "./workflow.service";

const idSchema = z.string().min(1).max(64);

/** نفس الشكل لكل action: تحقق ← service ← refresh ← رسالة عربي */
async function run(tag: string, okMessage: string, fn: (actor: Awaited<ReturnType<typeof requireUser>>) => Promise<unknown>): Promise<ActionState> {
  try {
    const actor = await requireUser();
    await fn(actor);
    refresh();
    return { ok: true, message: okMessage };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, message: e.issues[0]?.message ?? "يرجى مراجعة البيانات" };
    if (!isAppError(e)) console.error(`[workflow:${tag}]`, e);
    return { ok: false, message: toArabicMessage(e) };
  }
}

export async function savePathsAction(matrix: unknown): Promise<ActionState> {
  return run("paths", "تم حفظ مسار الاعتماد — ويُطبَّق على المستخلصات الجديدة والجارية", (a) => svc.savePaths(a, slaMatrixSchema.parse(matrix)));
}

export async function addReasonAction(name: string): Promise<ActionState> {
  return run("reason-add", "تمت إضافة السبب", (a) => svc.addReturnReason(a, reasonNameSchema.parse(name)));
}

export async function renameReasonAction(id: string, name: string): Promise<ActionState> {
  return run("reason-rename", "تم الحفظ بنجاح", (a) => svc.updateReturnReason(a, idSchema.parse(id), { name: reasonNameSchema.parse(name) }));
}

export async function toggleReasonAction(id: string, active: boolean): Promise<ActionState> {
  return run("reason-active", active ? "تم تفعيل السبب" : "تم تعطيل السبب — لن يظهر عند الإعادة للاستيفاء", (a) =>
    svc.updateReturnReason(a, idSchema.parse(id), { active: active === true }),
  );
}

export async function moveReasonAction(id: string, dir: number): Promise<ActionState> {
  return run("reason-move", "تم تغيير الترتيب", (a) => svc.moveReturnReason(a, idSchema.parse(id), dir < 0 ? -1 : 1));
}

export async function deleteReasonAction(id: string): Promise<ActionState> {
  return run("reason-del", "تم حذف السبب", (a) => svc.deleteReturnReason(a, idSchema.parse(id)));
}

export async function saveDocTypeAction(input: unknown): Promise<ActionState> {
  return run("doctype", "تم حفظ المستند", (a) => svc.saveDocType(a, docTypeSchema.parse(input)));
}

export async function setRequiredDocAction(input: unknown): Promise<ActionState> {
  return run("required-doc", "تم الحفظ بنجاح", (a) => {
    const { on, ...key } = requiredDocSchema.parse(input);
    return svc.setRequiredDoc(a, key, on);
  });
}

export async function addHolidayAction(input: unknown): Promise<ActionState> {
  return run("holiday-add", "تمت إضافة العطلة", (a) => {
    const h = holidaySchema.parse(input);
    return svc.addHoliday(a, h.date, h.name);
  });
}

export async function deleteHolidayAction(date: string): Promise<ActionState> {
  return run("holiday-del", "تم حذف العطلة", (a) => svc.removeHoliday(a, isoDateSchema.parse(date)));
}

export async function saveSettingsAction(input: unknown): Promise<ActionState> {
  return run("settings", "تم حفظ الإعدادات", (a) => svc.saveSettings(a, settingsSchema.parse(input)));
}
