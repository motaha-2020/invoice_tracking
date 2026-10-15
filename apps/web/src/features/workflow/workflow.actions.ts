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
    if (e instanceof z.ZodError) return { ok: false, message: e.issues[0]?.message ?? "راجع البيانات" };
    if (!isAppError(e)) console.error(`[workflow:${tag}]`, e);
    return { ok: false, message: toArabicMessage(e) };
  }
}

export async function savePathsAction(matrix: unknown): Promise<ActionState> {
  return run("paths", "اتحفظ المسار — المستخلصات الجديدة والمفتوحة هتمشي عليه", (a) => svc.savePaths(a, slaMatrixSchema.parse(matrix)));
}

export async function addReasonAction(name: string): Promise<ActionState> {
  return run("reason-add", "اتضاف السبب", (a) => svc.addReturnReason(a, reasonNameSchema.parse(name)));
}

export async function renameReasonAction(id: string, name: string): Promise<ActionState> {
  return run("reason-rename", "اتحفظ", (a) => svc.updateReturnReason(a, idSchema.parse(id), { name: reasonNameSchema.parse(name) }));
}

export async function toggleReasonAction(id: string, active: boolean): Promise<ActionState> {
  return run("reason-active", active ? "السبب اتفعّل" : "السبب اتوقف — مش هيظهر في الإرجاع", (a) =>
    svc.updateReturnReason(a, idSchema.parse(id), { active: active === true }),
  );
}

export async function moveReasonAction(id: string, dir: number): Promise<ActionState> {
  return run("reason-move", "اتغير الترتيب", (a) => svc.moveReturnReason(a, idSchema.parse(id), dir < 0 ? -1 : 1));
}

export async function deleteReasonAction(id: string): Promise<ActionState> {
  return run("reason-del", "اتمسح السبب", (a) => svc.deleteReturnReason(a, idSchema.parse(id)));
}

export async function saveDocTypeAction(input: unknown): Promise<ActionState> {
  return run("doctype", "اتحفظ المستند", (a) => svc.saveDocType(a, docTypeSchema.parse(input)));
}

export async function setRequiredDocAction(input: unknown): Promise<ActionState> {
  return run("required-doc", "اتحفظ", (a) => {
    const { on, ...key } = requiredDocSchema.parse(input);
    return svc.setRequiredDoc(a, key, on);
  });
}

export async function addHolidayAction(input: unknown): Promise<ActionState> {
  return run("holiday-add", "اتضافت الأجازة", (a) => {
    const h = holidaySchema.parse(input);
    return svc.addHoliday(a, h.date, h.name);
  });
}

export async function deleteHolidayAction(date: string): Promise<ActionState> {
  return run("holiday-del", "اتشالت الأجازة", (a) => svc.removeHoliday(a, isoDateSchema.parse(date)));
}

export async function saveSettingsAction(input: unknown): Promise<ActionState> {
  return run("settings", "اتحفظت الإعدادات", (a) => svc.saveSettings(a, settingsSchema.parse(input)));
}
