import "server-only";
import { isDomainError, payBlock, transition, type CategoryCode, type FlowCommand, type InvoiceFlowState } from "@it/domain";
import type { SessionUser } from "@/features/auth/auth.types";
import { visibleInvoicesWhere } from "@/features/auth/scope";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { getFlowContext, isCategoryCode, type FlowContext } from "./flow-config";
import type { MessageContext, MessageKind } from "./flow-messages";
import { messagesFor, recipientsFor } from "./flow-notify";
import { asCategory, flowAccess, type FlowAccess } from "./flow-access";
import { cloneLatestRevision, setApprovedQty, snapshotPaidDeductions, writeFlow, type FlowWrite } from "./flow.repo";
import { calcInvoice } from "./invoice-calc";
import { findInvoiceDetail, findRevisionContent, listActiveReturnReasons, type InvoiceDetail } from "./invoice.repo";

/**
 * حركات المسار على المستخلص (القاعدة 3 في architecture.md):
 * الصلاحية ← transition() من @it/domain ← writeFlow (حالة + سجل + تدقيق + إشعارات + بريد) في transaction واحدة.
 */

function flowState(inv: InvoiceDetail): InvoiceFlowState {
  return {
    status: inv.status,
    currentStep: inv.currentStep,
    ...asCategory(inv),
    returnTo: inv.returnTo,
    returnedFrom: inv.returnedFrom,
    heldAt: inv.heldAt,
    holdReason: inv.holdReason,
  };
}

// ── الأوامر ─────────────────────────────────────────────

export type ActCommand =
  | { type: "approve"; note?: string }
  | { type: "setCategory"; category: string; note?: string }
  | { type: "return"; target: string; reasonIds: string[]; note: string }
  | { type: "resubmit"; note: string }
  | { type: "hold"; reason: string }
  | { type: "release"; note?: string }
  | { type: "pay"; ref: string; method: string; note?: string }
  | { type: "qty"; lineId: string; qty: number; reason: string };

export type ActResult = { message: string };

const stepShort = (ctx: FlowContext, k: string | null | undefined) => (k ? (ctx.config.steps[k]?.short ?? k) : "—");
const stepName = (ctx: FlowContext, k: string | null | undefined) => (k ? (ctx.config.steps[k]?.name ?? k) : "—");

/** بيرمي AppError لو الحركة مش مسموحة */
function ensure(ok: boolean, msg = "لا تملك صلاحية تنفيذ هذا الإجراء على المستخلص في حالته الحالية") {
  if (!ok) throw new AppError("FORBIDDEN", msg);
}

function domain<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (isDomainError(e)) throw new AppError("VALIDATION", e.messageAr);
    throw e;
  }
}

/** ملاحظة الحركة: بالنيابة (تجاوز إداري) أو بالتفويض */
function actorNote(user: SessionUser, access: FlowAccess, holder: string, note: string | null | undefined, roleOfStep?: string): string | null {
  const t = note?.trim() || null;
  if (access.override) return `بالنيابة عن ${holder} (تجاوز إداري)${t ? ` — ${t}` : ""}`;
  if (roleOfStep) {
    const own = user.roles.some((r) => r.role === roleOfStep && !r.delegatedFrom);
    const via = user.roles.find((r) => r.role === roleOfStep && r.delegatedFrom)?.delegatedFrom;
    if (!own && via) return `بالتفويض عن ${via.name}${t ? ` — ${t}` : ""}`;
  }
  return t;
}

export async function act(user: SessionUser, invoiceId: string, cmd: ActCommand): Promise<ActResult> {
  const ctx = await getFlowContext();
  const inv = await findInvoiceDetail(invoiceId, visibleInvoicesWhere(user));
  if (!inv) throw new AppError("NOT_FOUND", "المستخلص غير موجود أو خارج نطاق صلاحيتك");
  const access = await flowAccess(user, inv, ctx);
  const state = flowState(inv);
  const holderKey = inv.status === "returned" ? inv.returnTo : inv.currentStep;
  const holder = holderKey === "company" ? inv.contract.company.name : stepShort(ctx, holderKey);
  const stepRole = holderKey && holderKey !== "company" ? ctx.stepRoles[holderKey] : holderKey === "company" ? "company" : undefined;
  const note = (n: string | null | undefined) => actorNote(user, access, holder, n, stepRole);
  const latest = inv.revisions[inv.revisions.length - 1] ?? null;

  let command: FlowCommand;
  const write: Omit<FlowWrite, "data" | "log" | "notifications" | "emails"> & { extraData?: FlowWrite["data"] } = {
    invoiceId: inv.id,
    expect: { status: inv.status, currentStep: inv.currentStep },
    audit: { userId: user.id, action: `invoice.${cmd.type}` },
  };
  let kind: MessageKind | null = null;
  let message = "";
  let messageExtra: Partial<MessageContext> = {};

  switch (cmd.type) {
    case "approve": {
      ensure(access.canApprove);
      command = { type: "approve", note: note(cmd.note) ?? undefined };
      kind = "approved";
      break;
    }
    case "setCategory": {
      ensure(access.canCategory);
      if (!isCategoryCode(cmd.category)) throw new AppError("VALIDATION", "فئة التجاوز غير صحيحة");
      // المقارنة بالفئة المقترحة من الكميات الحالية (بعد أي تعديل في الكميات المعتمدة)
      const content = latest ? await findRevisionContent(latest.id) : null;
      const suggested = (await calcInvoice(inv, content)).suggestion.category;
      if (cmd.category !== suggested && !cmd.note?.trim()) {
        throw new AppError("VALIDATION", `يرجى توضيح سبب اختيار فئة تختلف عن الفئة المقترحة (${suggested})`);
      }
      const n = note(cmd.note);
      command = { type: "setCategory", category: cmd.category as CategoryCode, note: n ? `تحديد الفئة ${cmd.category} — ${n}` : undefined };
      message = `تم تحديد الفئة ${cmd.category} — ${ctx.config.categories[cmd.category as CategoryCode]?.name ?? ""}`;
      break;
    }
    case "return": {
      ensure(access.canReturn);
      const active = await listActiveReturnReasons();
      const chosen = active.filter((r) => cmd.reasonIds.includes(r.id));
      command = { type: "return", target: cmd.target, reasonIds: chosen.map((r) => r.id), note: note(cmd.note) ?? "" };
      kind = cmd.target === "company" ? "returned_company" : "returned_step";
      messageExtra = { reasons: chosen.map((r) => r.name) };
      break;
    }
    case "resubmit": {
      ensure(access.canResubmit);
      if (!cmd.note.trim()) throw new AppError("VALIDATION", "يرجى توضيح ما تم استيفاؤه");
      let suggested: CategoryCode | null = null;
      if (access.companyResubmit) {
        // المقاول: نسخة جديدة (لو لسه ما اتفتحتش وهو بيعدّل) والفئة المقترحة تتحسب من جديد
        const lastReturn = [...inv.log].reverse().find((e) => e.action === "return");
        const open = latest && lastReturn && latest.createdAt > lastReturn.at;
        if (!open) {
          const n = note(cmd.note);
          write.extra = async (tx) => {
            await cloneLatestRevision(tx, inv.id, user.id, n);
          };
        }
        const content = latest ? await findRevisionContent(latest.id) : null;
        suggested = (await calcInvoice(inv, content)).suggestion.category;
      }
      command = { type: "resubmit", note: note(cmd.note) ?? undefined, suggestedCategory: suggested };
      kind = "resubmitted";
      break;
    }
    case "hold": {
      ensure(access.canHold);
      command = { type: "hold", reason: cmd.reason };
      kind = "held";
      break;
    }
    case "release": {
      ensure(access.canRelease);
      command = { type: "release", note: note(cmd.note) ?? undefined };
      kind = "released";
      break;
    }
    case "pay": {
      ensure(access.canPay);
      const ref = cmd.ref.trim();
      const method = cmd.method.trim() || "شيك";
      const content = latest ? await findRevisionContent(latest.id) : null;
      const calc = await calcInvoice(inv, content);
      // قرار التشغيل: قفل تام عند تجاوز الارتباط المالي (حتى للتجاوز الإداري)
      const blocked = payBlock(calc.commitment);
      if (blocked) throw new AppError("CONFLICT", blocked);
      const net = calc.totals.net;
      command = { type: "pay", ref, note: note(cmd.note ?? `تم السداد — ${method} رقم ${ref}`) ?? undefined };
      write.extraData = { paidAt: new Date(), paymentRef: ref, paymentMethod: method, paymentAmount: net, deductionsSet: true };
      // تجميد الاستقطاعات والمحتجز وقت السداد: أي تغيير لاحق في شروط العقد ما يغيّرش مستخلص مصروف
      write.extra = (tx) => snapshotPaidDeductions(tx, inv.id, calc.totals, inv.deductionsSet);
      kind = "paid";
      messageExtra = { paymentRef: `${method} رقم ${ref}`, amount: formatMoney(net) };
      break;
    }
    case "qty": {
      ensure(access.canEditQty);
      if (!Number.isFinite(cmd.qty) || cmd.qty < 0) throw new AppError("VALIDATION", "يرجى إدخال كمية صحيحة (صفر أو أكثر)");
      if (!cmd.reason.trim()) throw new AppError("VALIDATION", "يرجى توضيح سبب تعديل الكمية المعتمدة");
      if (!latest) throw new AppError("NOT_FOUND");
      const content = await findRevisionContent(latest.id);
      const line = content?.lines.find((l) => l.id === cmd.lineId);
      if (!line) throw new AppError("NOT_FOUND", "البند غير موجود في النسخة الحالية من المستخلص");
      const itemNo = line.contractItem?.itemNo ?? line.newItemNo ?? "";
      const before = Number(line.approvedQty ?? line.qty);
      const n = note(cmd.reason) ?? "";
      const logNote = `البند ${itemNo}: الكمية المعتمدة من ${before} إلى ${cmd.qty} — ${n}`;
      const ok = await writeFlow({
        ...write,
        data: { updatedAt: new Date() },
        extra: (tx) => setApprovedQty(tx, line.id, latest.id, cmd.qty, n),
        log: { action: "qty", fromStep: holderKey, toStep: holderKey, note: logNote, onBehalf: access.override, byId: user.id },
        audit: { ...write.audit, details: { line: itemNo, from: before, to: cmd.qty } },
        notifications: [],
        emails: [],
      });
      if (!ok) throw new AppError("CONFLICT");
      return { message: `تم تعديل الكمية المعتمدة للبند ${itemNo}` };
    }
  }

  const result = domain(() => transition(state, command, ctx.config));
  const s = result.state;
  const data: FlowWrite["data"] = {
    status: s.status,
    currentStep: s.currentStep,
    category: s.category,
    suggestedCategory: s.suggestedCategory,
    returnTo: s.returnTo,
    returnedFrom: s.returnedFrom,
    heldAt: s.heldAt,
    holdReason: s.holdReason,
    ...(result.resetsClock ? { since: new Date() } : {}),
    ...write.extraData,
  };
  const le = result.logEntry;

  // المستلمون: الجهة اللي المستخلص وصل لها
  const target = s.status === "returned" ? s.returnTo : s.status === "paid" || s.status === "on_hold" ? "company" : s.currentStep;
  const recipients = kind ? await recipientsFor(ctx, inv, target, user.id) : [];
  const stepForMsg = target && target !== "company" ? stepName(ctx, target) : undefined;

  const mctx: MessageContext | null = kind
    ? {
        kind,
        invoiceNo: inv.invoiceNo,
        companyName: inv.contract.company.name,
        aoNo: inv.ao.aoNo,
        pathName: inv.pathName,
        stepName: stepForMsg,
        fromName: le.fromStep === "company" ? inv.contract.company.name : stepShort(ctx, le.fromStep),
        note: le.note,
        url: `${env.appUrl}/invoices/${inv.id}`,
        ...messageExtra,
      }
    : null;

  const ok = await writeFlow({
    ...write,
    data,
    log: {
      action: le.action,
      fromStep: le.fromStep,
      toStep: le.toStep,
      category: le.category ?? null,
      note: le.note,
      onBehalf: access.override,
      byId: user.id,
      reasonIds: le.reasonIds,
    },
    audit: { ...write.audit, details: { from: le.fromStep, to: le.toStep, ...(le.category ? { category: le.category } : {}) } },
    ...messagesFor(mctx, recipients),
  });
  if (!ok) throw new AppError("CONFLICT");

  return { message: message || successMessage(cmd.type, ctx, s.status === "returned" ? s.returnTo : s.currentStep, inv.contract.company.name) };
}

function successMessage(type: ActCommand["type"], ctx: FlowContext, to: string | null, company: string): string {
  switch (type) {
    case "approve":
      return `تم الاعتماد والإحالة إلى ${stepShort(ctx, to)}`;
    case "return":
      return `تمت الإعادة للاستيفاء إلى ${to === "company" ? company : stepShort(ctx, to)}`;
    case "resubmit":
      return `تمت إعادة التقديم إلى ${stepShort(ctx, to)}`;
    case "hold":
      return "تم إيقاف المستخلص مؤقتاً — توقف احتساب المدة المستهدفة";
    case "release":
      return `تم الاستئناف في ${stepShort(ctx, to)}`;
    case "pay":
      return "تم تسجيل السداد";
    default:
      return "تم الحفظ";
  }
}
