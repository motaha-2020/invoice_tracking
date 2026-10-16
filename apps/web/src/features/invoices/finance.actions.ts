"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { isAppError, toArabicMessage, type ActionState } from "@/lib/errors";
import { releaseRetention, saveDeductions } from "./finance.service";

const id = z.string().min(1).max(64);

const rowSchema = z.object({
  type: z.enum(["tax", "penalty", "other"]),
  name: z.string().trim().min(1, "يرجى إدخال اسم لكل استقطاع").max(200),
  mode: z.enum(["pct", "amount"]),
  value: z.number("يرجى إدخال قيمة صحيحة").finite().min(0).max(1e13),
  note: z.string().trim().max(500).nullish(),
});

async function run(tag: string, fn: () => Promise<string>): Promise<ActionState> {
  try {
    const message = await fn();
    refresh();
    return { ok: true, message };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, message: e.issues[0]?.message ?? "يرجى مراجعة البيانات" };
    if (!isAppError(e)) console.error(`[finance:${tag}]`, e);
    return { ok: false, message: toArabicMessage(e) };
  }
}

export async function saveDeductionsAction(invoiceId: string, input: { rows: unknown; note?: string }): Promise<ActionState> {
  const user = await requireUser();
  return run("deductions", async () => {
    const rows = z.array(rowSchema).max(20).parse(input.rows);
    const res = await saveDeductions(user, id.parse(invoiceId), rows, z.string().max(1000).parse(input.note ?? ""));
    return `تم حفظ الاستقطاعات — صافي المستحق ${res.net.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} جنيه`;
  });
}

export async function releaseRetentionAction(deductionId: string, input: unknown): Promise<ActionState> {
  const user = await requireUser();
  return run("release", async () => {
    const data = z
      .object({
        ref: z.string().trim().min(1, "يرجى إدخال رقم الشيك أو التحويل البنكي").max(60),
        method: z.enum(["شيك", "تحويل بنكي"]),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "يرجى اختيار تاريخ الصرف"),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(input);
    return (await releaseRetention(user, id.parse(deductionId), data)).message;
  });
}
