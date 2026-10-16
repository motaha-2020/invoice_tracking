"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { parseWorkbook, MAX_IMPORT_BYTES } from "@/features/imports/xlsx-parse";
import { isAppError, toArabicMessage, type ActionState } from "@/lib/errors";
import { replaceReturnedContent } from "./attachments.service";
import { draftPayloadSchema, lineRowsSchema, materialRowsSchema } from "./draft.schema";
import * as svc from "./draft.service";
import type { AoWorkspace, LineRowState, MaterialRowState } from "./draft.types";

type Result<T> = { ok: true; data: T; message?: string } | { ok: false; message: string };

async function run<T>(tag: string, fn: (user: Awaited<ReturnType<typeof requireUser>>) => Promise<T>, message?: (d: T) => string): Promise<Result<T>> {
  const user = await requireUser();
  try {
    const data = await fn(user);
    return { ok: true, data, message: message?.(data) };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, message: e.issues[0]?.message ?? "يرجى مراجعة البيانات" };
    if (!isAppError(e)) console.error(`[draft:${tag}]`, e);
    return { ok: false, message: toArabicMessage(e) };
  }
}

const id = z.string().min(1).max(64);

export async function loadAoWorkspaceAction(aoId: string, draftId: string | null): Promise<Result<AoWorkspace>> {
  return run("workspace", (u) => svc.getAoWorkspace(u, id.parse(aoId), draftId ? id.parse(draftId) : null));
}

export async function saveDraftAction(payload: unknown): Promise<Result<{ draftId: string; lines: number; materials: number }>> {
  return run("save", (u) => svc.saveDraft(u, draftPayloadSchema.parse(payload)), () => "تم حفظ المسودة");
}

export async function submitDraftAction(draftId: string): Promise<Result<{ invoiceId: string; message: string }>> {
  const r = await run("submit", (u) => svc.submitDraft(u, id.parse(draftId)), (d) => d.message);
  if (r.ok) refresh();
  return r;
}

export async function discardDraftAction(draftId: string): Promise<ActionState> {
  const r = await run("discard", (u) => svc.discardDraft(u, id.parse(draftId)));
  return r.ok ? { ok: true, message: "تم حذف المسودة" } : { ok: false, message: r.message };
}

/** قراءة ملف Excel (قالب 09 بنود أو 10 مهمات) ← صفوف للمعاينة */
export async function parseRowsFileAction(form: FormData): Promise<Result<{ lines: LineRowState[]; materials: MaterialRowState[]; fileName: string }>> {
  return run("parse", async () => {
    const file = form.get("file");
    const kind = form.get("kind");
    if (!(file instanceof File) || !file.size) throw new z.ZodError([{ code: "custom", path: ["file"], message: "يرجى اختيار ملف Excel" }]);
    if (file.size > MAX_IMPORT_BYTES) throw new z.ZodError([{ code: "custom", path: ["file"], message: "حجم الملف أكبر من الحد المسموح (10 ميجابايت)" }]);
    let wb;
    try {
      wb = await parseWorkbook(await file.arrayBuffer(), []);
    } catch {
      throw new z.ZodError([{ code: "custom", path: ["file"], message: "تعذّرت قراءة الملف — يرجى التأكد من أنه ملف Excel بصيغة النموذج المعتمد" }]);
    }
    const sheetName = kind === "materials" ? "مهمات المستخلص" : "بنود المستخلص";
    const sheet = wb.sheets[sheetName] ?? Object.values(wb.sheets).find((s) => s.kind === "table");
    const rows = sheet?.kind === "table" ? sheet.rows : [];
    const str = (v: unknown) => (v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());
    const num = (v: unknown) => (typeof v === "number" ? v : str(v));
    if (kind === "materials") {
      const materials = rows.map((r) => ({ code: str(r.material_code), qty: num(r.executed_qty) })).filter((r) => r.code);
      if (!materials.length) throw new z.ZodError([{ code: "custom", path: ["file"], message: `لم يُعثر على مهمات في ورقة «${sheetName}» — يرجى استخدام النموذج 10` }]);
      return { lines: [], materials, fileName: file.name };
    }
    const lines = rows.map((r) => ({ code: str(r.item_code), qty: num(r.qty), site: str(r.site_code) })).filter((r) => r.code);
    if (!lines.length) throw new z.ZodError([{ code: "custom", path: ["file"], message: `لم يُعثر على بنود في ورقة «${sheetName}» — يرجى استخدام النموذج 09` }]);
    return { lines, materials: [], fileName: file.name };
  });
}

/** المقاول بيستبدل البنود / المهمات في مستخلص معاد له للاستيفاء */
export async function replaceReturnedContentAction(invoiceId: string, input: { lines?: unknown; materials?: unknown; siteCode?: string }): Promise<ActionState> {
  const r = await run(
    "replace",
    (u) =>
      replaceReturnedContent(u, id.parse(invoiceId), {
        lines: input.lines ? lineRowsSchema.parse(input.lines) : undefined,
        materials: input.materials ? materialRowsSchema.parse(input.materials) : undefined,
        siteCode: input.siteCode?.trim() || null,
      }),
    (d) => [d.lines != null ? `تم تحديث البنود (${d.lines} بند)` : "", d.materials != null ? `تم تحديث المهمات (${d.materials} صنف)` : ""].filter(Boolean).join(" — "),
  );
  if (r.ok) refresh();
  return r.ok ? { ok: true, message: r.message } : { ok: false, message: r.message };
}
