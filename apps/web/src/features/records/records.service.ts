import "server-only";
import type { z } from "zod";
import { CATEGORY_CODES } from "@it/domain";
import type { SessionUser } from "@/features/auth/auth.types";
import { can } from "@/features/auth/permissions";
import { removeStoredFile } from "@/features/invoices/attachments.storage";
import { getFlowContext } from "@/features/invoices/flow-config";
import { HOLD_REASON_AO, migratedCategory, type MigratedState } from "@/features/invoices/history.mapping";
import { AppError } from "@/lib/errors";
import { ENTITY_LABEL, aoFields, invoiceFields, type FieldSpec, type RecordEntity, type RecordValues, type SelectOption } from "./records.fields";
import * as repo from "./records.repo";
import { aoItemSchema, aoSchema, contractItemSchema, invoiceSchema, migratedInvoiceSchema, toFormValue } from "./records.schema";

/**
 * تعديل وحذف السجلات — مدير النظام فقط (records.manage).
 * الحذف ممنوع لو السجل عليه بيانات تابعة مهمة (مستخلصات، بنود مفوترة…) والرسالة بتقول المطلوب.
 * كل تعديل بيتسجل في audit_log بالقيم قبل وبعد.
 */
export const canManageRecords = (user: SessionUser) => can(user, "records.manage");

async function assertManage(user: SessionUser) {
  if (!(await canManageRecords(user))) throw new AppError("FORBIDDEN", "تعديل البيانات وحذفها متاح لمدير النظام فقط");
}

const notFound = (e: RecordEntity) => new AppError("NOT_FOUND", `${ENTITY_LABEL[e]} غير موجود — ربما حُذف`);

function parse<S extends z.ZodTypeAny>(schema: S, input: RecordValues): z.output<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw new AppError("VALIDATION", r.error.issues[0]?.message ?? "يرجى مراجعة البيانات المُدخلة");
  return r.data;
}

/** الحقول اللي اتغيرت فعلاً (بمقارنة نص النموذج) — للـ audit */
function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const out: Record<string, { from: string; to: string }> = {};
  for (const k of Object.keys(after)) {
    const a = toFormValue(before[k]);
    const b = toFormValue(after[k]);
    if (a !== b) out[k] = { from: a, to: b };
  }
  return out;
}

const uniqueError = (e: unknown, msg: string) => {
  if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") throw new AppError("CONFLICT", msg, { cause: e });
  throw e;
};

// ── مراحل المستخلص المرحّل ──

/** خيارات "مرحلة الاعتماد الحالية": المقاول ← مراحل المسار بالترتيب ← موقوف ← تم السداد */
async function stageOptions(): Promise<SelectOption[]> {
  const { config } = await getFlowContext();
  const keys: string[] = [];
  for (const c of CATEGORY_CODES) for (const p of config.categories[c]?.path ?? []) if (!keys.includes(p.step)) keys.push(p.step);
  return [
    { value: "draft", label: "لدى المقاول (مسودة)" },
    ...keys.map((k) => ({ value: k, label: config.steps[k]?.name ?? k })),
    { value: "on_hold", label: `موقوف مؤقتاً — ${HOLD_REASON_AO}` },
    { value: "paid", label: "تم السداد" },
  ];
}

const stageOf = (i: { status: string; currentStep: string | null }) =>
  i.status === "active" ? (i.currentStep ?? "sup") : i.status === "returned" ? (i.currentStep ?? "sup") : i.status;

function stateOfStage(stage: string): MigratedState {
  if (stage === "draft") return { status: "draft", currentStep: null, heldAt: null, holdReason: null };
  if (stage === "paid") return { status: "paid", currentStep: null, heldAt: null, holdReason: null };
  if (stage === "on_hold") return { status: "on_hold", currentStep: "sup", heldAt: "sup", holdReason: HOLD_REASON_AO };
  return { status: "active", currentStep: stage, heldAt: null, holdReason: null };
}

// ── نموذج التعديل (الحقول + القيم الحالية) ──

export type RecordForm = { fields: FieldSpec[]; values: RecordValues };

const valuesOf = (fields: FieldSpec[], rec: Record<string, unknown>): RecordValues =>
  Object.fromEntries(fields.map((f) => [f.key, toFormValue(rec[f.key])]));

export async function aoForm(user: SessionUser, id: string): Promise<RecordForm | null> {
  if (!(await canManageRecords(user))) return null;
  const [ao, projects] = await Promise.all([repo.findAo(id), repo.listProjectOptions()]);
  if (!ao) return null;
  const fields = aoFields(projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })));
  return { fields, values: valuesOf(fields, ao) };
}

export async function invoiceForm(user: SessionUser, id: string): Promise<RecordForm | null> {
  if (!(await canManageRecords(user))) return null;
  const [inv, workTypes] = await Promise.all([repo.findInvoice(id), repo.listWorkTypeOptions()]);
  if (!inv) return null;
  const fields = invoiceFields(workTypes.map((w) => ({ value: w.id, label: w.name })), inv.migrated ? await stageOptions() : null);
  return { fields, values: valuesOf(fields, { ...inv, stage: stageOf(inv) }) };
}

// ── التعديل ──

export async function updateRecord(user: SessionUser, entity: RecordEntity, id: string, input: RecordValues): Promise<string> {
  await assertManage(user);
  const base = { userId: user.id, entity, entityId: id };

  switch (entity) {
    case "ao": {
      const ao = await repo.findAo(id);
      if (!ao) throw notFound(entity);
      const d = parse(aoSchema, input);
      const changes = diff(ao, d);
      if (!Object.keys(changes).length) return "لا توجد تعديلات للحفظ";
      await repo.updateAo(id, d, { ...base, action: "ao.update", details: { aoNo: ao.aoNo, changes } }).catch((e) =>
        uniqueError(e, `رقم أمر التكليف ${d.aoNo} مستخدم من قبل على نفس العقد`),
      );
      return "تم حفظ بيانات أمر التكليف";
    }
    case "contractItem": {
      const it = await repo.findContractItem(id);
      if (!it) throw notFound(entity);
      const d = parse(contractItemSchema, input);
      if (d.isGroup && it._count.aoItems + it._count.invoiceLines > 0) {
        throw new AppError("CONFLICT", "لا يمكن تحويل البند إلى عنوان لأنه مستخدم في أوامر التكليف أو المستخلصات");
      }
      const data = d.isGroup ? { ...d, contractQty: null, unitPrice: null } : d;
      const changes = diff(it, data);
      if (!Object.keys(changes).length) return "لا توجد تعديلات للحفظ";
      await repo.updateContractItem(id, data, { ...base, action: "contract_item.update", details: { itemNo: it.itemNo, changes } }).catch((e) =>
        uniqueError(e, `رقم البند ${d.itemNo} مستخدم من قبل في جدول الكميات`),
      );
      return "تم حفظ البند";
    }
    case "aoItem": {
      const it = await repo.findAoItem(id);
      if (!it) throw notFound(entity);
      const d = parse(aoItemSchema, input);
      const changes = diff(it, d);
      if (!Object.keys(changes).length) return "لا توجد تعديلات للحفظ";
      await repo.updateAoItem(id, d.plannedQty, { ...base, action: "ao_item.update", details: { aoNo: it.ao.aoNo, itemNo: it.contractItem.itemNo, changes } });
      return "تم حفظ الكمية المخططة";
    }
    case "invoice":
      return updateInvoice(user, id, input);
    case "contract":
      throw new AppError("VALIDATION", "بيانات العقد تُعدَّل من زر «تعديل بيانات العقد»");
  }
}

async function updateInvoice(user: SessionUser, id: string, input: RecordValues): Promise<string> {
  const inv = await repo.findInvoice(id);
  if (!inv) throw notFound("invoice");
  const base = { userId: user.id, entity: "invoice", entityId: id };

  if (!inv.migrated) {
    const d = parse(invoiceSchema, input);
    const changes = diff(inv, d);
    if (!Object.keys(changes).length) return "لا توجد تعديلات للحفظ";
    await repo.updateInvoice(id, d, { ...base, action: "invoice.update", details: { invoiceNo: inv.invoiceNo, changes } }, null).catch((e) =>
      uniqueError(e, `رقم المستخلص ${d.invoiceNo} مستخدم من قبل على نفس العقد`),
    );
    return "تم حفظ بيانات المستخلص";
  }

  // المستخلص المرحّل: كمان المبلغ والمرحلة (المسار بيترسم من المرحلة + فئة التجاوز)
  const d = parse(migratedInvoiceSchema, input);
  const options = await stageOptions();
  if (!options.some((o) => o.value === d.stage)) throw new AppError("VALIDATION", "مرحلة الاعتماد غير صحيحة");
  const { stage, ...fields } = d;
  const changes = diff({ ...inv, stage: stageOf(inv) }, d);
  if (!Object.keys(changes).length) return "لا توجد تعديلات للحفظ";

  let data: Record<string, unknown> = fields;
  let log: repo.StageLog | null = null;
  if (changes.stage) {
    const { config } = await getFlowContext();
    const st = stateOfStage(stage);
    const paid = st.status === "paid";
    data = { ...fields, ...st, category: migratedCategory(config, st), since: new Date(), returnTo: null, returnedFrom: null, paidAt: paid ? new Date() : null, submittedAt: st.status === "draft" ? null : undefined };
    const label = options.find((o) => o.value === stage)!.label;
    log = { action: paid ? "pay" : st.status === "on_hold" ? "hold" : "approve", toStep: st.heldAt ?? st.currentStep, note: `تعديل إداري للمرحلة: ${label}`, byId: user.id };
  }
  await repo.updateInvoice(id, data, { ...base, action: "invoice.update", details: { invoiceNo: inv.invoiceNo, migrated: true, changes } }, log).catch((e) =>
    uniqueError(e, `رقم المستخلص ${d.invoiceNo} مستخدم من قبل على نفس العقد`),
  );
  return "تم حفظ بيانات المستخلص";
}

// ── الحذف ──

export async function deleteRecord(user: SessionUser, entity: RecordEntity, id: string): Promise<string> {
  await assertManage(user);
  const base = { userId: user.id, entity, entityId: id };
  let files: string[] = [];

  switch (entity) {
    case "contract": {
      const c = await repo.findContract(id);
      if (!c) throw notFound(entity);
      if (c._count.invoices) throw new AppError("CONFLICT", `لا يمكن حذف العقد ${c.contractNo} لأن عليه ${c._count.invoices} مستخلص — يرجى حذف المستخلصات أولاً`);
      files = await repo.deleteContract(id, { ...base, action: "contract.delete", details: { contractNo: c.contractNo, aos: c._count.assignmentOrders } });
      break;
    }
    case "ao": {
      const ao = await repo.findAo(id);
      if (!ao) throw notFound(entity);
      if (ao._count.invoices) throw new AppError("CONFLICT", `لا يمكن حذف أمر التكليف ${ao.aoNo} لأن عليه ${ao._count.invoices} مستخلص — يرجى حذف المستخلصات أو نقلها أولاً`);
      files = await repo.deleteAo(id, { ...base, action: "ao.delete", details: { aoNo: ao.aoNo, contractId: ao.contractId } });
      break;
    }
    case "contractItem": {
      const it = await repo.findContractItem(id);
      if (!it) throw notFound(entity);
      if (it._count.aoItems || it._count.invoiceLines) {
        throw new AppError("CONFLICT", `لا يمكن حذف البند ${it.itemNo} لأنه مستخدم في ${it._count.aoItems} بند أمر تكليف و${it._count.invoiceLines} بند مستخلص`);
      }
      await repo.deleteContractItem(id, { ...base, action: "contract_item.delete", details: { contractId: it.contractId, itemNo: it.itemNo, description: it.description } });
      break;
    }
    case "aoItem": {
      const it = await repo.findAoItem(id);
      if (!it) throw notFound(entity);
      await repo.deleteAoItem(id, { ...base, action: "ao_item.delete", details: { aoNo: it.ao.aoNo, itemNo: it.contractItem.itemNo, plannedQty: Number(it.plannedQty) } });
      break;
    }
    case "invoice": {
      const inv = await repo.findInvoice(id);
      if (!inv) throw notFound(entity);
      files = await repo.deleteInvoice(id, { ...base, action: "invoice.delete", details: { invoiceNo: inv.invoiceNo, contractId: inv.contractId, status: inv.status, migrated: inv.migrated } });
      break;
    }
  }
  await Promise.all(files.map((f) => removeStoredFile(f).catch(() => undefined)));
  return `تم حذف ${ENTITY_LABEL[entity]}`;
}
