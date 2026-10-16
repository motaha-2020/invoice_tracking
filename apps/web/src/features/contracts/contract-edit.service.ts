import "server-only";
import type { SessionUser } from "@/features/auth/auth.types";
import { can } from "@/features/auth/permissions";
import { ALLOWED_TYPES, MAX_ATTACHMENT_BYTES, extOf, readStoredFile, removeStoredFile, saveFile } from "@/features/invoices/attachments.storage";
import { AppError } from "@/lib/errors";
import * as repo from "./contract-edit.repo";
import type { ContractEditField, ContractEditInput } from "./contract-edit.schema";
import { contractsScopeWhere, checkPaymentTerms } from "./contracts.rules";
import { docKinds, isContractDocKind, type ContractDocKind } from "./contracts.labels";

/** تعديل بيانات العقد ومرفقاته: الشئون الفنية ومدير النظام (contracts.edit). العرض والتنزيل لأي حد يشوف العقد */
async function assertEdit(user: SessionUser) {
  if (!(await can(user, "contracts.edit"))) throw new AppError("FORBIDDEN", "تعديل بيانات العقد متاح للشئون الفنية ومدير النظام فقط");
}

export const canEditContracts = (user: SessionUser) => can(user, "contracts.edit");

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const dateOf = (s: string | null) => (s ? new Date(`${s}T00:00:00.000Z`) : null);
const num = (v: { toString(): string } | null) => (v == null ? null : Number(v.toString()));

/** القيم الحالية بنفس شكل النموذج (لملء الشاشة ولمقارنة التغييرات) */
type Current = NonNullable<Awaited<ReturnType<typeof repo.findContractForEdit>>>;
function formValues(c: Current): ContractEditInput {
  return {
    title: c.title,
    contractValue: num(c.contractValue),
    currency: c.currency,
    awardDate: iso(c.awardDate),
    startDate: iso(c.startDate),
    endDate: iso(c.endDate),
    payMonthlyPct: num(c.payMonthlyPct)!,
    payAsbuiltPct: num(c.payAsbuiltPct)!,
    payHandoverPct: num(c.payHandoverPct)!,
    planningPayPct: num(c.planningPayPct)!,
    vatPct: num(c.vatPct)!,
    taxPct: num(c.taxPct),
    finalGuaranteePct: num(c.finalGuaranteePct)!,
    delayFinePctWeek: num(c.delayFinePctWeek),
    delayFineCapPct: num(c.delayFineCapPct),
    warrantyMonths: c.warrantyMonths,
    stampEngineeringPct: num(c.stampEngineeringPct)!,
    stampAppliedArtsPct: num(c.stampAppliedArtsPct)!,
    stampConstructionPct: num(c.stampConstructionPct)!,
    retentionPct: num(c.retentionPct)!,
    advancePct: num(c.advancePct)!,
    outOfScopeUplift: c.outOfScopeUplift,
  };
}

export async function getContractEditValues(user: SessionUser, id: string): Promise<ContractEditInput | null> {
  if (!(await canEditContracts(user))) return null;
  const c = await repo.findContractForEdit(id, contractsScopeWhere(user));
  return c ? formValues(c) : null;
}

export async function updateContractTerms(user: SessionUser, id: string, v: ContractEditInput): Promise<number> {
  await assertEdit(user);
  const c = await repo.findContractForEdit(id, contractsScopeWhere(user));
  if (!c) throw new AppError("NOT_FOUND", "العقد غير موجود");
  const terms = checkPaymentTerms(v.payMonthlyPct, v.payAsbuiltPct, v.payHandoverPct);
  if (!terms.ok) throw new AppError("VALIDATION", terms.message);

  const before = formValues(c);
  const changed = (Object.keys(v) as ContractEditField[]).filter((k) => before[k] !== v[k]);
  if (!changed.length) return 0;
  await repo.updateContract(
    id,
    { ...v, awardDate: dateOf(v.awardDate), startDate: dateOf(v.startDate), endDate: dateOf(v.endDate) },
    {
      userId: user.id,
      action: "contract.update",
      entity: "contract",
      entityId: id,
      details: { contractNo: c.contractNo, changes: Object.fromEntries(changed.map((k) => [k, { from: before[k], to: v[k] }])) },
    },
  );
  return changed.length;
}

// ── المرفقات ───────────────────────────────────────────

export type ContractFile = { id: string; kind: ContractDocKind; kindLabel: string; note: string | null; fileName: string; size: number; uploadedAt: string; uploadedBy: string | null };

/** مرفقات العقد، أو مرفقات أمر تكليف واحد لو اتبعت aoId */
export async function listContractFiles(contractId: string, aoId: string | null = null): Promise<ContractFile[]> {
  const rows = await repo.listContractFiles(contractId, aoId);
  const kinds = docKinds(aoId != null);
  const names = await repo.uploaderNames([...new Set(rows.map((r) => r.uploadedById).filter((x): x is string => !!x))]);
  return rows.map((r) => {
    const kind = isContractDocKind(r.kind, aoId != null) ? r.kind : "other";
    return {
      id: r.id,
      kind,
      kindLabel: kinds[kind] ?? "مستند آخر",
      note: r.note,
      fileName: r.fileName,
      size: r.size,
      uploadedAt: r.uploadedAt.toISOString(),
      uploadedBy: r.uploadedById ? (names.get(r.uploadedById) ?? null) : null,
    };
  });
}

const MAX_MB = MAX_ATTACHMENT_BYTES / 1024 / 1024;

export async function uploadContractFile(user: SessionUser, contractId: string, file: File, kind: unknown, note: string | null, aoId: string | null = null): Promise<void> {
  await assertEdit(user);
  if (!isContractDocKind(kind, aoId != null)) throw new AppError("VALIDATION", "يرجى اختيار نوع المستند");
  if (!file.size) throw new AppError("VALIDATION", "الملف فارغ");
  if (file.size > MAX_ATTACHMENT_BYTES) throw new AppError("VALIDATION", `حجم الملف يتجاوز الحد الأقصى (${MAX_MB} ميجابايت)`);
  const name = file.name.replace(/[\\/\0]/g, "_").slice(0, 200) || "ملف";
  if (!ALLOWED_TYPES[extOf(name)]) throw new AppError("VALIDATION", `نوع الملف غير مسموح — الأنواع المسموحة: ${Object.keys(ALLOWED_TYPES).join("، ")}`);
  const c = await repo.findContractForEdit(contractId, contractsScopeWhere(user));
  if (!c) throw new AppError("NOT_FOUND", "العقد غير موجود");
  const ao = aoId ? await repo.findAoOfContract(contractId, aoId) : null;
  if (aoId && !ao) throw new AppError("NOT_FOUND", "أمر التكليف غير موجود في هذا العقد");
  const stored = await saveFile(Buffer.from(await file.arrayBuffer()), name);
  try {
    await repo.insertContractFile(
      { contractId, aoId: ao?.id ?? null, kind, note: note?.trim().slice(0, 300) || null, fileName: name, storagePath: stored.storagePath, mimeType: stored.mimeType, size: file.size, sha256: stored.sha256, uploadedById: user.id },
      { userId: user.id, action: "contract.file.upload", entity: "contract", details: { contractNo: c.contractNo, aoNo: ao?.aoNo, kind, fileName: name } },
    );
  } catch (e) {
    await removeStoredFile(stored.storagePath);
    throw e;
  }
}

export async function readContractFile(user: SessionUser, id: string): Promise<{ data: Buffer; fileName: string; mimeType: string }> {
  const f = await repo.findContractFile(id, contractsScopeWhere(user));
  if (!f) throw new AppError("NOT_FOUND", "الملف غير موجود");
  return { data: await readStoredFile(f.storagePath), fileName: f.fileName, mimeType: f.mimeType };
}

export async function deleteContractFile(user: SessionUser, id: string): Promise<void> {
  await assertEdit(user);
  const f = await repo.findContractFile(id, contractsScopeWhere(user));
  if (!f) throw new AppError("NOT_FOUND", "الملف غير موجود");
  await repo.deleteContractFile(id, { userId: user.id, action: "contract.file.delete", entity: "contract", entityId: f.contractId, details: { aoId: f.aoId, kind: f.kind, fileName: f.fileName } });
  await removeStoredFile(f.storagePath);
}
