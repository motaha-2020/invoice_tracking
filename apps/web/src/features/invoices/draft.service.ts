import "server-only";
import { checkLineRows, checkMaterialRows, isDomainError, transition, INITIAL_FLOW_STATE } from "@it/domain";
import type { SessionUser } from "@/features/auth/auth.types";
import { can } from "@/features/auth/permissions";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { cleanupFiles } from "./attachments.service";
import { storagePathsOfInvoice } from "./attachments.repo";
import { companyIdsOf } from "./company-scope";
import { catalogMap, draftBlockers, lineContext } from "./draft-preview";
import * as repo from "./draft.repo";
import type { AoWorkspace, ContractOption, DraftPayload, DraftState, WorkTypeOption } from "./draft.types";
import { getFlowContext } from "./flow-config";
import { messagesFor, recipientsFor } from "./flow-notify";
import { writeFlow } from "./flow.repo";
import { calcInvoice } from "./invoice-calc";
import { findInvoiceDetail, findRevisionContent, materialFigures, plannedByItem, plannedValue, prevQtyByItem, requiredDocsFor, grossByInvoiceOnAo } from "./invoice.repo";

/**
 * معالج المستخلص الجديد (المقاول): مسودة ← بنود ← مهمات ← مرفقات ← تقديم.
 * كل حاجة بتتحقق هنا تاني حتى لو المتصفح اتحقق (نفس دوال @it/domain).
 */

const n = (v: { toString(): string } | null | undefined): number | null => (v == null ? null : Number(v.toString()));

async function assertCreate(user: SessionUser): Promise<string[]> {
  if (!(await can(user, "invoice.create"))) throw new AppError("FORBIDDEN");
  const ids = companyIdsOf(user);
  if (!ids.length) throw new AppError("FORBIDDEN", "حسابك غير مرتبط بشركة منفذة — يرجى التواصل مع مدير النظام");
  return ids;
}

export async function getWizardOptions(user: SessionUser): Promise<{ contracts: ContractOption[]; workTypes: WorkTypeOption[] }> {
  const ids = await assertCreate(user);
  const [contracts, workTypes] = await Promise.all([repo.listCompanyContracts(ids), repo.listActiveWorkTypes()]);
  return {
    contracts: contracts.map((c) => ({
      id: c.id,
      contractNo: c.contractNo,
      title: c.title,
      aos: c.assignmentOrders.map((a) => ({ id: a.id, aoNo: a.aoNo, name: a.name, project: a.project?.name ?? null, pending: a.status === "pending_approval" })),
    })),
    workTypes,
  };
}

const toRecord = <V>(m: Map<string, V>): Record<string, V> => Object.fromEntries(m);

export async function getAoWorkspace(user: SessionUser, aoId: string, draftId: string | null): Promise<AoWorkspace> {
  const ids = await assertCreate(user);
  const ao = await repo.findAoWorkspace(aoId, ids);
  if (!ao) throw new AppError("NOT_FOUND", "أمر التكليف غير موجود أو مغلق");
  const seq = (await repo.maxSeqOnAo(aoId, draftId)) + 1;
  const [planned, prev, mats, catalog, docs, docTypes, gross, pv] = await Promise.all([
    plannedByItem(aoId),
    prevQtyByItem(aoId, seq, draftId),
    materialFigures(aoId, seq, draftId),
    repo.listMaterialCatalog(),
    ao.project ? requiredDocsFor(ao.project.type.id) : Promise.resolve([]),
    repo.listDocTypes(),
    grossByInvoiceOnAo(aoId),
    plannedValue(aoId),
  ]);
  const c = ao.project?.central;
  const others = gross.filter((g) => g.id !== draftId);
  return {
    ao: {
      id: ao.id,
      aoNo: ao.aoNo,
      name: ao.name,
      pending: ao.status === "pending_approval",
      value: n(ao.value) ?? pv,
      financialCommitment: n(ao.financialCommitment),
      contractId: ao.contract.id,
      contractNo: ao.contract.contractNo,
    },
    org: {
      presidency: c?.dept.generalDept.sector.presidency.name ?? "—",
      sector: c?.dept.generalDept.sector.name ?? "—",
      generalDept: c?.dept.generalDept.name ?? "—",
      dept: c?.dept.name ?? "—",
      central: c?.name ?? ao.centralText ?? "—",
      projectType: ao.project?.type.name ?? "—",
      project: ao.project?.name ?? "—",
    },
    terms: {
      vatPct: Number(ao.contract.vatPct),
      payMonthlyPct: Number(ao.contract.payMonthlyPct),
      payAsbuiltPct: Number(ao.contract.payAsbuiltPct),
      payHandoverPct: Number(ao.contract.payHandoverPct),
      planningPayPct: Number(ao.contract.planningPayPct),
      taxPct: n(ao.contract.taxPct),
    },
    items: ao.contract.items.map((i) => ({ id: i.id, itemNo: i.itemNo, isGroup: i.isGroup, description: i.description, unit: i.unit, unitPrice: n(i.unitPrice), workType: i.workType })),
    planned: toRecord(planned),
    prev: toRecord(prev),
    sites: ao.sites.map((s) => ({ code: s.code, name: s.name })),
    catalog,
    matPlanned: toRecord(mats.planned),
    matIssued: toRecord(mats.issued),
    matPrev: toRecord(mats.prev),
    requiredDocs: docs.filter((d) => d.stage === "submit").map((d) => d.docType),
    docTypes,
    billed: others.reduce((a, g) => a + Number(g.gross), 0),
    billedCount: others.length,
  };
}

/** مسودة محفوظة ← حالة المعالج */
export async function loadDraft(user: SessionUser, id: string): Promise<DraftState | null> {
  const ids = await assertCreate(user);
  const inv = await repo.findCompanyInvoice(id, ids);
  if (!inv || inv.status !== "draft") return null;
  const rev = inv.revisions[0];
  const site = rev?.lines.find((l) => l.site)?.site?.code ?? "";
  return {
    draftId: inv.id,
    contractId: inv.contractId,
    aoId: inv.aoId,
    invoiceNo: inv.invoiceNo,
    pathName: inv.pathName,
    period: inv.period ?? "",
    workTypeId: inv.workTypeId ?? "",
    siteCode: site,
    lines: (rev?.lines ?? []).map((l) => ({ code: l.contractItem?.itemNo ?? "", qty: Number(l.qty), site: l.site?.code ?? "" })),
    linesSource: rev?.lines.length ? "draft" : "",
    linesFile: "",
    materials: (rev?.materials ?? []).map((m) => ({ code: m.material.code, qty: Number(m.executedQty) })),
    materialsSource: rev?.materials.length ? "draft" : "",
    materialsFile: "",
    attachments: (rev?.attachments ?? []).map((a) => ({ id: a.id, fileName: a.fileName, size: a.size, uploadedAt: a.uploadedAt.toISOString(), docTypeId: a.docTypeId })),
  };
}

/**
 * حفظ المسودة: البيانات الأساسية + البنود والمهمات الصحيحة بس (الصفوف اللي فيها أخطاء بتفضل في المعالج لحد ما تتصلح).
 * رقم المستخلص لازم يبقى فريد على العقد.
 */
export async function saveDraft(user: SessionUser, p: DraftPayload): Promise<{ draftId: string; lines: number; materials: number }> {
  const ids = await assertCreate(user);
  const ao = await repo.findAoWorkspace(p.aoId, ids);
  if (!ao) throw new AppError("NOT_FOUND", "أمر التكليف غير موجود أو مغلق");
  if (p.draftId) {
    const d = await repo.findCompanyInvoice(p.draftId, ids);
    if (!d || d.status !== "draft") throw new AppError("CONFLICT", "المسودة لم تعد قابلة للتعديل — ربما قُدِّمت بالفعل");
  }
  const invoiceNo = p.invoiceNo.trim();
  const dup = await repo.findInvoiceNoOnContract(ao.contract.id, invoiceNo);
  if (dup && dup.id !== p.draftId) throw new AppError("CONFLICT", `رقم المستخلص ${invoiceNo} مسجل من قبل على العقد نفسه`);
  const workTypes = await repo.listActiveWorkTypes();
  if (!workTypes.some((w) => w.id === p.workTypeId)) throw new AppError("VALIDATION", "يرجى اختيار نوع الأعمال");

  const items = ao.contract.items.map((i) => ({ id: i.id, itemNo: i.itemNo, isGroup: i.isGroup, unitPrice: n(i.unitPrice), description: i.description, unit: i.unit, workType: i.workType }));
  const planned = await plannedByItem(ao.id);
  const lc = checkLineRows(p.lines, lineContext({ items, planned: toRecord(planned), sites: ao.sites }, p.siteCode.trim() || null));
  const mc = checkMaterialRows(p.materials, catalogMap({ catalog: await repo.listMaterialCatalog() }));
  const siteIds = new Map(ao.sites.map((s) => [s.code, s.id]));

  const seq = (await repo.maxSeqOnAo(ao.id, p.draftId)) + 1;
  const id = await repo.upsertDraft(
    p.draftId,
    {
      aoId: ao.id,
      contractId: ao.contract.id,
      invoiceNo,
      seq,
      pathName: p.pathName.trim(),
      period: p.period.trim() || null,
      workTypeId: p.workTypeId,
      lines: lc.lines.map((l, i) => ({ contractItemId: l.contractItemId, qty: l.qty, siteId: l.siteCode ? (siteIds.get(l.siteCode) ?? null) : null, sort: i })),
      materials: mc.mats.map((m) => ({ materialId: m.materialId, executedQty: m.executedQty })),
    },
    user.id,
    { action: p.draftId ? "invoice.draft.update" : "invoice.draft.create", details: { invoiceNo, ao: ao.aoNo, lines: lc.lines.length, materials: mc.mats.length } },
  );
  return { draftId: id, lines: lc.lines.length, materials: mc.mats.length };
}

/** تقديم المسودة: الموانع ← الفئة المقترحة ← transition(submit) ← إشعار المرحلة الأولى */
export async function submitDraft(user: SessionUser, draftId: string): Promise<{ invoiceId: string; message: string }> {
  const ids = await assertCreate(user);
  const ctx = await getFlowContext();
  const inv = await findInvoiceDetail(draftId, { contract: { companyId: { in: ids } } });
  if (!inv || inv.status !== "draft") throw new AppError("CONFLICT", "المستخلص ليس مسودة — ربما قُدِّم بالفعل");
  const latest = inv.revisions[inv.revisions.length - 1];
  const rev = latest ? await findRevisionContent(latest.id) : null;
  const docs = inv.ao.project ? (await requiredDocsFor(inv.ao.project.type.id)).filter((d) => d.stage === "submit").map((d) => d.docType) : [];
  const have = new Set((rev?.attachments ?? []).map((a) => a.docType?.id).filter((x): x is string => !!x));
  const calc = await calcInvoice(inv, rev);
  const blockers = draftBlockers(
    { invoiceNo: inv.invoiceNo, pathName: inv.pathName, workTypeId: inv.workType?.id ?? "", aoId: inv.ao.id },
    null,
    docs,
    have,
  );
  if (!calc.lines.length) blockers.unshift({ step: 2, text: "لا توجد بنود أعمال في المستخلص" });
  if (blockers.length) throw new AppError("VALIDATION", `لا يمكن تقديم المستخلص قبل استكمال: ${blockers.map((b) => b.text).join("؛ ")}`);

  let res;
  try {
    res = transition(INITIAL_FLOW_STATE, { type: "submit", suggestedCategory: calc.suggestion.category }, ctx.config);
  } catch (e) {
    if (isDomainError(e)) throw new AppError("VALIDATION", e.messageAr);
    throw e;
  }
  const s = res.state;
  const recipients = await recipientsFor(ctx, inv, s.currentStep, user.id);
  const stepName = s.currentStep ? (ctx.config.steps[s.currentStep]?.name ?? s.currentStep) : "";
  const msgs = messagesFor(
    {
      kind: "submitted",
      invoiceNo: inv.invoiceNo,
      companyName: inv.contract.company.name,
      aoNo: inv.ao.aoNo,
      pathName: inv.pathName,
      stepName,
      url: `${env.appUrl}/invoices/${inv.id}`,
    },
    recipients,
  );
  const now = new Date();
  const ok = await writeFlow({
    invoiceId: inv.id,
    expect: { status: "draft", currentStep: null },
    data: { status: s.status, currentStep: s.currentStep, suggestedCategory: s.suggestedCategory, since: now, submittedAt: now },
    log: { action: "submit", fromStep: "company", toStep: s.currentStep, note: res.logEntry.note, onBehalf: false, byId: user.id },
    audit: { userId: user.id, action: "invoice.submit", details: { suggested: s.suggestedCategory, gross: calc.totals.gross } },
    ...msgs,
  });
  if (!ok) throw new AppError("CONFLICT");
  return { invoiceId: inv.id, message: `تم تقديم المستخلص رقم ${inv.invoiceNo} — أُحيل إلى ${stepName}` };
}

export async function discardDraft(user: SessionUser, id: string): Promise<void> {
  const ids = await assertCreate(user);
  const inv = await repo.findCompanyInvoice(id, ids);
  if (!inv || inv.status !== "draft") throw new AppError("NOT_FOUND");
  const files = (await storagePathsOfInvoice(id)).map((f) => f.storagePath);
  await repo.deleteDraft(id);
  await cleanupFiles(files);
}
