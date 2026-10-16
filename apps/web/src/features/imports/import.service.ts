import "server-only";
import { prisma, type Prisma } from "@it/db";
import { can } from "@/features/auth/permissions";
import { AppError } from "@/lib/errors";
import type { ImportContext, ImportPreview, RowResult } from "./import.types";
import { createBatch, findBatch, markBatch } from "./import.repo";
import { getImporter } from "./registry";
import "./importers";
import { MAX_IMPORT_BYTES, parseWorkbook } from "./xlsx-parse";

/** ملخص المعاينة اللي بيرجع للواجهة */
export type PreviewSummary = {
  batchId: string;
  templateId: string;
  title: string;
  notes: string[];
  counts: { create: number; update: number; skip: number; error: number; warnings: number };
  rows: Omit<RowResult, "data">[];
};

/** الخطوة 1: قراءة الملف + فحصه + تخزين المعاينة (من غير أي تعديل على البيانات) */
export async function previewImport(templateId: string, file: File, ctx: ImportContext): Promise<PreviewSummary> {
  const importer = getImporter(templateId);
  if (!importer) throw new AppError("NOT_FOUND", "نوع النموذج غير معروف");
  if (!(await can(ctx.user, importer.permission))) throw new AppError("FORBIDDEN");
  if (file.size === 0) throw new AppError("VALIDATION", "الملف فارغ");
  if (file.size > MAX_IMPORT_BYTES) throw new AppError("VALIDATION", "حجم الملف يتجاوز 10 ميجابايت");
  if (!/\.xlsx$/i.test(file.name)) throw new AppError("VALIDATION", "يجب أن يكون الملف بصيغة Excel ‏(xlsx)");

  const kv = importer.sheets.filter((s) => s.kind === "kv").map((s) => s.name);
  let wb;
  try {
    wb = await parseWorkbook(await file.arrayBuffer(), kv);
  } catch (e) {
    throw new AppError("VALIDATION", "الملف ليس ملف Excel صالحاً أو أنه تالف", { cause: e });
  }
  if (wb.templateId && wb.templateId !== templateId) {
    throw new AppError("VALIDATION", `هذا الملف من نموذج "${wb.templateId}" وليس "${importer.title}" — يرجى تحميل النموذج الصحيح من زر «تحميل النموذج»`);
  }
  const missing = importer.sheets.filter((s) => s.required !== false && !wb.sheets[s.name]).map((s) => s.name);
  if (missing.length) throw new AppError("VALIDATION", `أوراق العمل التالية غير موجودة في الملف: ${missing.join("، ")} — يرجى استخدام النموذج المعتمد`);

  const preview = await importer.validate(wb, ctx);
  // صفوف المثال اللي اتجاهلت لازم تبان — ممكن تكون بيانات حقيقية مطابقة للمثال بالصدفة
  for (const [sheet, rows] of Object.entries(wb.skippedExamples)) {
    preview.notes.push(`تم تجاهل ${rows.length} صف في ورقة العمل "${sheet}" لتطابقها مع صفوف المثال في النموذج (الصفوف ${rows.join("، ")}). إذا كانت بيانات فعلية يرجى تعديل أي خانة فيها وإعادة الرفع.`);
  }
  const batch = await createBatch({
    templateId,
    fileName: file.name.slice(0, 200),
    userId: ctx.user.id,
    rows: preview.rows.length,
    report: preview as unknown as Prisma.InputJsonValue,
  });
  return summarize(batch.id, importer.title, preview);
}

/** الخطوة 2: الحفظ — الصفوف السليمة بس، جوه transaction واحدة */
export async function commitImport(batchId: string, ctx: ImportContext) {
  const batch = await findBatch(batchId);
  if (!batch || batch.userId !== ctx.user.id) throw new AppError("NOT_FOUND", "نتيجة المراجعة غير متاحة — يرجى إعادة رفع الملف");
  if (batch.status !== "preview") throw new AppError("CONFLICT", "تم استيراد هذا الملف من قبل");
  const importer = getImporter(batch.templateId);
  if (!importer) throw new AppError("NOT_FOUND");
  if (!(await can(ctx.user, importer.permission))) throw new AppError("FORBIDDEN");

  const preview = batch.report as unknown as ImportPreview;
  const valid: ImportPreview = { ...preview, rows: preview.rows.filter((r) => r.status !== "error" && r.status !== "skip") };
  if (!valid.rows.length) throw new AppError("VALIDATION", "لا توجد صفوف صحيحة قابلة للحفظ");

  return prisma.$transaction(
    async (tx) => {
      const result = await importer.commit(valid, tx, ctx);
      await markBatch(tx, batch.id, "done", { ...result, errors: preview.rows.filter((r) => r.status === "error").length });
      await tx.auditLog.create({
        data: { userId: ctx.user.id, action: "import", entity: batch.templateId, entityId: batch.id, details: { file: batch.fileName, ...result.counts } },
      });
      return result;
    },
    { timeout: 120_000 },
  );
}

function summarize(batchId: string, title: string, p: ImportPreview): PreviewSummary {
  const counts = { create: 0, update: 0, skip: 0, error: 0, warnings: 0 };
  for (const r of p.rows) {
    counts[r.status]++;
    if (r.warnings.length) counts.warnings++;
  }
  // الواجهة مش محتاجة data (ممكن تبقى كبيرة) — بنبعت الحالة والرسائل بس
  const rows = p.rows.map(({ data: _data, ...rest }) => rest);
  return { batchId, templateId: p.templateId, title, notes: p.notes, counts, rows };
}
