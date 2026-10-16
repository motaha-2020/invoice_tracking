"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { isAppError, toArabicMessage, type ActionState } from "@/lib/errors";
import { deleteRecord, updateRecord } from "./records.service";

const entity = z.enum(["contract", "ao", "contractItem", "aoItem", "invoice"]);
const id = z.string().min(1).max(64);
const values = z.record(z.string(), z.string().max(5000));

export async function updateRecordAction(e: unknown, recordId: unknown, input: unknown): Promise<ActionState> {
  try {
    const user = await requireUser();
    const message = await updateRecord(user, entity.parse(e), id.parse(recordId), values.parse(input));
    refresh();
    return { ok: true, message };
  } catch (err) {
    if (!isAppError(err) && !(err instanceof z.ZodError)) console.error("[records:update]", err);
    return { ok: false, message: err instanceof z.ZodError ? "يرجى مراجعة البيانات المُدخلة" : toArabicMessage(err) };
  }
}

export async function deleteRecordAction(e: unknown, recordId: unknown): Promise<ActionState> {
  try {
    const user = await requireUser();
    const message = await deleteRecord(user, entity.parse(e), id.parse(recordId));
    refresh();
    return { ok: true, message };
  } catch (err) {
    if (!isAppError(err) && !(err instanceof z.ZodError)) console.error("[records:delete]", err);
    return { ok: false, message: toArabicMessage(err) };
  }
}
