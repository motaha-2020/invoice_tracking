import "server-only";
import { checkLineRows, checkMaterialRows, type LineRowInput, type MaterialRowInput } from "@it/domain";
import type { SessionUser } from "@/features/auth/auth.types";
import { visibleInvoicesWhere } from "@/features/auth/scope";
import { AppError } from "@/lib/errors";
import * as repo from "./attachments.repo";
import { ALLOWED_TYPES, MAX_ATTACHMENT_BYTES, extOf, readStoredFile, removeStoredFile, saveFile } from "./attachments.storage";
import { catalogMap, lineContext } from "./draft-preview";
import { findAoWorkspace, findCompanyInvoice, listMaterialCatalog, replaceRevisionContent } from "./draft.repo";
import { companyIdsOf } from "./company-scope";
import { plannedByItem } from "./invoice.repo";

/**
 * المرفقات + تعديل المقاول للمستخلص:
 * المقاول يقدر يعدّل (يرفع / يحذف / يستبدل البنود) في المسودة، أو في المستخلص المعاد له للاستيفاء —
 * وفي الحالة التانية أول تعديل بيفتح نسخة جديدة، والنسخة المقدمة قبل كده بتفضل زي ما هي في السجل.
 */

const MAX_MB = MAX_ATTACHMENT_BYTES / 1024 / 1024;

/** النسخة القابلة للتعديل (وبيفتح نسخة جديدة لو المستخلص معاد للمقاول ولسه ما اتفتحتش) */
async function editableRevision(user: SessionUser, invoiceId: string): Promise<{ revisionId: string; aoId: string; status: string }> {
  const ids = companyIdsOf(user);
  if (!ids.length) throw new AppError("FORBIDDEN");
  const inv = await findCompanyInvoice(invoiceId, ids);
  if (!inv) throw new AppError("NOT_FOUND", "المستخلص غير موجود أو خارج نطاق صلاحيتك");
  const latest = inv.revisions[0];
  if (!latest) throw new AppError("NOT_FOUND");
  if (inv.status === "draft") return { revisionId: latest.id, aoId: inv.aoId, status: inv.status };
  if (inv.status !== "returned" || inv.returnTo !== "company") {
    throw new AppError("CONFLICT", "لا يمكن تعديل المستخلص إلا وهو مسودة أو معاد إليكم للاستيفاء");
  }
  const lastReturn = inv.log[0]?.at;
  if (lastReturn && latest.createdAt > lastReturn) return { revisionId: latest.id, aoId: inv.aoId, status: inv.status };
  const revisionId = await repo.openNewRevision(inv.id, user.id, "تحديث المقاول أثناء الاستيفاء");
  return { revisionId, aoId: inv.aoId, status: inv.status };
}

export async function uploadAttachment(user: SessionUser, invoiceId: string, file: File, docTypeId: string | null) {
  if (!file.size) throw new AppError("VALIDATION", "الملف فارغ");
  if (file.size > MAX_ATTACHMENT_BYTES) throw new AppError("VALIDATION", `حجم الملف يتجاوز الحد الأقصى (${MAX_MB} ميجابايت)`);
  const name = file.name.replace(/[\\/\0]/g, "_").slice(0, 200) || "ملف";
  if (!ALLOWED_TYPES[extOf(name)]) {
    throw new AppError("VALIDATION", `نوع الملف غير مسموح — الأنواع المسموحة: ${Object.keys(ALLOWED_TYPES).join("، ")}`);
  }
  if (docTypeId && !(await repo.docTypeExists(docTypeId))) throw new AppError("VALIDATION", "نوع المستند غير معروف");
  const { revisionId } = await editableRevision(user, invoiceId);
  const stored = await saveFile(Buffer.from(await file.arrayBuffer()), name);
  try {
    const a = await repo.insertAttachment(
      { revisionId, docTypeId, fileName: name, storagePath: stored.storagePath, mimeType: stored.mimeType, size: file.size, sha256: stored.sha256, uploadedById: user.id },
      { userId: user.id, invoiceId },
    );
    return { id: a.id, fileName: a.fileName, size: a.size, uploadedAt: a.uploadedAt.toISOString(), docTypeId: a.docTypeId };
  } catch (e) {
    await removeStoredFile(stored.storagePath);
    throw e;
  }
}

export async function deleteAttachment(user: SessionUser, attachmentId: string): Promise<void> {
  const ids = companyIdsOf(user);
  const a = await repo.findAttachment(attachmentId, { contract: { companyId: { in: ids } } });
  if (!a) throw new AppError("NOT_FOUND");
  const { revisionId } = await editableRevision(user, a.revision.invoiceId);
  // لو اتفتحت نسخة جديدة دلوقتي، المرفق في النسخة القديمة — نحذف المقابل له في الجديدة
  const target = revisionId === a.revisionId ? a : await repo.findAttachmentByPath(revisionId, a.storagePath);
  if (!target) throw new AppError("NOT_FOUND");
  const left = await repo.deleteAttachmentRow(target.id, target.storagePath, { userId: user.id, invoiceId: a.revision.invoiceId, fileName: target.fileName });
  if (left === 0) await removeStoredFile(target.storagePath);
}

/** تنزيل مرفق — لأي حد يشوف المستخلص */
export async function readAttachment(user: SessionUser, attachmentId: string) {
  const a = await repo.findAttachment(attachmentId, visibleInvoicesWhere(user));
  if (!a) throw new AppError("NOT_FOUND");
  return { fileName: a.fileName, mimeType: a.mimeType, data: await readStoredFile(a.storagePath) };
}

/** المقاول بيستبدل البنود و/أو المهمات في مستخلص معاد له (لازم تكون كلها سليمة) */
export async function replaceReturnedContent(
  user: SessionUser,
  invoiceId: string,
  input: { lines?: LineRowInput[]; materials?: MaterialRowInput[]; siteCode?: string | null },
): Promise<{ lines: number | null; materials: number | null }> {
  const { revisionId, aoId, status } = await editableRevision(user, invoiceId);
  if (status !== "returned") throw new AppError("CONFLICT", "تعديل البنود في المسودة يتم من شاشة المستخلص الجديد");
  const ao = await findAoWorkspace(aoId, companyIdsOf(user));
  if (!ao) throw new AppError("NOT_FOUND");
  let lines = null;
  if (input.lines) {
    const items = ao.contract.items.map((i) => ({ ...i, unitPrice: i.unitPrice == null ? null : Number(i.unitPrice) }));
    const planned = Object.fromEntries(await plannedByItem(aoId));
    const lc = checkLineRows(input.lines, lineContext({ items, planned, sites: ao.sites }, input.siteCode ?? null));
    if (lc.err) throw new AppError("VALIDATION", `يوجد ${lc.err} صف في ملف البنود به أخطاء — يرجى التصحيح وإعادة الرفع`);
    if (!lc.lines.length) throw new AppError("VALIDATION", "ملف البنود لا يتضمن بنوداً");
    const siteIds = new Map(ao.sites.map((s) => [s.code, s.id]));
    lines = lc.lines.map((l, i) => ({ contractItemId: l.contractItemId, qty: l.qty, siteId: l.siteCode ? (siteIds.get(l.siteCode) ?? null) : null, sort: i }));
  }
  let materials = null;
  if (input.materials) {
    const mc = checkMaterialRows(input.materials, catalogMap({ catalog: await listMaterialCatalog() }));
    if (mc.err) throw new AppError("VALIDATION", `يوجد ${mc.err} صف في ملف المهمات به أخطاء — يرجى التصحيح وإعادة الرفع`);
    materials = mc.mats.map((m) => ({ materialId: m.materialId, executedQty: m.executedQty }));
  }
  await replaceRevisionContent(revisionId, lines, materials);
  await repo.auditInvoice(user.id, invoiceId, "invoice.revision.update", { lines: lines?.length ?? null, materials: materials?.length ?? null });
  return { lines: lines?.length ?? null, materials: materials?.length ?? null };
}

/** بعد حذف مسودة: امسح ملفاتها اللي مش مستخدمة في أي حتة تانية */
export async function cleanupFiles(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const refs = new Set((await repo.countStoragePathRefs(paths)).map((r) => r.storagePath));
  await Promise.all(paths.filter((p) => !refs.has(p)).map((p) => removeStoredFile(p)));
}
