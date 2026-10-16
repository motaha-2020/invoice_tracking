"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { isAppError, toArabicMessage, type ActionState } from "@/lib/errors";
import { delegationSchema, userSchema } from "./users.schema";
import { isPermission, parseRole } from "./users.rules";
import * as svc from "./users.service";
import type { InviteLink } from "./users.types";

function fail(e: unknown, tag: string): ActionState {
  if (!isAppError(e)) console.error(`[users:${tag}]`, e);
  return { ok: false, message: toArabicMessage(e) };
}

const idSchema = z.string().min(1).max(64);

export type SaveUserState = ActionState & { userId?: string; created?: boolean };

export async function saveUserAction(input: unknown): Promise<SaveUserState> {
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors, message: "يرجى مراجعة البيانات" };
  try {
    const actor = await requireUser();
    const res = await svc.saveUser(actor, parsed.data);
    refresh();
    return { ok: true, message: res.created ? "تمت إضافة المستخدم" : "تم حفظ التعديل", userId: res.id, created: res.created };
  } catch (e) {
    return fail(e, "save");
  }
}

export async function setActiveAction(userId: string, active: boolean): Promise<ActionState> {
  try {
    const actor = await requireUser();
    await svc.setActive(actor, idSchema.parse(userId), active === true);
    refresh();
    return { ok: true, message: active ? "تم تفعيل الحساب" : "تم إيقاف الحساب وتسجيل خروجه من جميع الأجهزة" };
  } catch (e) {
    return fail(e, "active");
  }
}

export type InviteState = ActionState & { link?: string };

export async function inviteUserAction(userId: string): Promise<InviteState> {
  try {
    const actor = await requireUser();
    const { link } = await svc.inviteUser(actor, idSchema.parse(userId));
    refresh();
    return { ok: true, message: "تم تسجيل الدعوة في قائمة البريد الإلكتروني الصادر", link };
  } catch (e) {
    return fail(e, "invite");
  }
}

export type BulkInviteState = ActionState & { links?: InviteLink[] };

export async function inviteNewUsersAction(): Promise<BulkInviteState> {
  try {
    const actor = await requireUser();
    const links = await svc.inviteNewUsers(actor);
    refresh();
    return { ok: true, message: links.length ? `تم إنشاء ${links.length} دعوة` : "لا يوجد مستخدمون جدد بحاجة إلى دعوة", links };
  } catch (e) {
    return fail(e, "bulk-invite");
  }
}

export async function addDelegationAction(input: unknown): Promise<ActionState> {
  const parsed = delegationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors, message: "يرجى مراجعة بيانات التفويض" };
  try {
    const actor = await requireUser();
    await svc.addDelegation(actor, parsed.data);
    refresh();
    return { ok: true, message: "تم تسجيل التفويض" };
  } catch (e) {
    return fail(e, "delegation");
  }
}

export async function deleteDelegationAction(id: string): Promise<ActionState> {
  try {
    const actor = await requireUser();
    await svc.deleteDelegation(actor, idSchema.parse(id));
    refresh();
    return { ok: true, message: "تم إلغاء التفويض" };
  } catch (e) {
    return fail(e, "delegation-del");
  }
}

export async function togglePermissionAction(permission: string, role: string, on: boolean): Promise<ActionState> {
  const r = parseRole(role);
  if (!isPermission(permission) || !r) return { ok: false, message: "الصلاحية أو الدور الوظيفي غير معروف" };
  try {
    const actor = await requireUser();
    await svc.togglePermission(actor, permission, r, on === true);
    refresh();
    return { ok: true, message: on ? "تمت إضافة الصلاحية" : "تمت إزالة الصلاحية" };
  } catch (e) {
    return fail(e, "perm");
  }
}
