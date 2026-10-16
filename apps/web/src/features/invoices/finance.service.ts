import "server-only";
import { HELD_LABELS, RELEASE_DOCS, deductionAmount, releaseDocPresent, validateDeductions, type DeductionRow, type HeldType } from "@it/domain";
import type { SessionUser } from "@/features/auth/auth.types";
import { can } from "@/features/auth/permissions";
import { visibleInvoicesWhere } from "@/features/auth/scope";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import * as repo from "./finance.repo";
import { getFlowContext } from "./flow-config";
import { messagesFor, recipientsFor } from "./flow-notify";
import { writeFlow } from "./flow.repo";
import { calcInvoice } from "./invoice-calc";
import { findInvoiceDetail, findRevisionContent } from "./invoice.repo";

/**
 * المالية (المرحلة 4):
 * - مراجعة الاستقطاعات قبل السداد: الخصم الضريبي، استقطاعات أخرى، الغرامات (يدوي بسبب — قرار التشغيل).
 * - صرف المبالغ المحتجزة على نفس المستخلص بعد إرفاق مستندها (قرار التشغيل).
 */

const n = (v: { toString(): string } | null | undefined): number | null => (v == null ? null : Number(v.toString()));

export type EditorRow = DeductionRow & { amount: number };

/** صفوف محرر الاستقطاعات: المحفوظة لو المالية راجعت قبل كده، وإلا الافتراضية من العقد */
export async function deductionEditorRows(inv: NonNullable<Awaited<ReturnType<typeof findInvoiceDetail>>>, gross: number): Promise<EditorRow[]> {
  if (inv.deductionsSet) {
    return inv.deductions
      .filter((d) => d.type === "tax" || d.type === "penalty" || d.type === "other")
      .map((d) => {
        const pct = n(d.pct);
        const row: DeductionRow = { type: d.type as DeductionRow["type"], name: d.name, mode: pct != null ? "pct" : "amount", value: pct ?? n(d.amount) ?? 0, note: d.note };
        return { ...row, amount: deductionAmount(row, gross) };
      });
  }
  const tax = n(inv.contract.taxPct);
  if (!tax) return [];
  const row: DeductionRow = { type: "tax", name: "خصم ضريبي من المنبع", mode: "pct", value: tax };
  return [{ ...row, amount: deductionAmount(row, gross) }];
}

export async function saveDeductions(user: SessionUser, invoiceId: string, rows: DeductionRow[], note: string): Promise<{ net: number }> {
  if (!(await can(user, "deductions.edit"))) throw new AppError("FORBIDDEN");
  const inv = await findInvoiceDetail(invoiceId, visibleInvoicesWhere(user));
  if (!inv) throw new AppError("NOT_FOUND", "المستخلص غير موجود أو خارج نطاق صلاحيتك");
  if (inv.status === "draft" || inv.status === "paid") throw new AppError("CONFLICT", "تُعدَّل الاستقطاعات قبل السداد فقط");
  const err = validateDeductions(rows);
  if (err) throw new AppError("VALIDATION", err);

  const latest = inv.revisions[inv.revisions.length - 1];
  const calc = await calcInvoice(inv, latest ? await findRevisionContent(latest.id) : null);
  const gross = calc.totals.gross;
  const summary = rows.map((r) => `${r.name}: ${r.mode === "pct" ? `${r.value}%` : formatMoney(r.value)}${r.note ? ` (${r.note})` : ""}`).join(" · ") || "دون استقطاعات";

  const ok = await writeFlow({
    invoiceId: inv.id,
    expect: { status: inv.status, currentStep: inv.currentStep },
    data: { deductionsSet: true },
    extra: (tx) =>
      repo.replaceEditableDeductions(
        tx,
        inv.id,
        rows.map((r) => ({
          type: r.type,
          name: r.name.trim(),
          pct: r.mode === "pct" ? r.value : null,
          amount: r.mode === "amount" ? r.value : deductionAmount(r, gross),
          note: r.note?.trim() || null,
          releasable: false,
        })),
      ),
    log: {
      action: "deductions",
      fromStep: inv.currentStep,
      toStep: inv.currentStep,
      note: [note.trim(), summary].filter(Boolean).join("\n"),
      onBehalf: false,
      byId: user.id,
    },
    audit: { userId: user.id, action: "invoice.deductions", details: { rows: rows.map((r) => ({ ...r })) } },
    notifications: [],
    emails: [],
  });
  if (!ok) throw new AppError("CONFLICT");
  const fresh = await findInvoiceDetail(inv.id, {});
  const after = await calcInvoice(fresh!, latest ? await findRevisionContent(latest.id) : null);
  return { net: after.totals.net };
}

// ── المبالغ المحتجزة ─────────────────────────────────────

export type RetentionView = repo.RetentionRow & { docOk: boolean };

export async function listRetentionsFor(user: SessionUser, filter: { released?: boolean; type?: HeldType }) {
  const rows = await repo.listRetentions(visibleInvoicesWhere(user), filter);
  const codes = new Map<string, string[]>();
  await Promise.all([...new Set(rows.map((r) => r.invoice.id))].map(async (id) => codes.set(id, await repo.attachedDocCodes(id))));
  const out: RetentionView[] = rows.map((r) => ({ ...r, docOk: releaseDocPresent(r.type as HeldType, codes.get(r.invoice.id) ?? []) }));
  const sum = (xs: RetentionView[]) => xs.reduce((a, r) => a + Number(r.amount ?? 0), 0);
  const pending = out.filter((r) => !r.releasedAt);
  return {
    rows: out,
    totals: { pending: sum(pending), ready: sum(pending.filter((r) => r.docOk)), released: sum(out.filter((r) => r.releasedAt)) },
    canRelease: await can(user, "retentions.release"),
  };
}

/** مستندات الصرف لكل نوع محتجز (للمودال: أي نوع مستند يترفع) */
export async function releaseDocTypes(type: HeldType) {
  return repo.docTypeIdsByCodes(RELEASE_DOCS[type]);
}

export async function releaseRetention(
  user: SessionUser,
  id: string,
  input: { ref: string; method: string; date: string; note?: string },
): Promise<{ message: string }> {
  if (!(await can(user, "retentions.release"))) throw new AppError("FORBIDDEN");
  const r = await repo.findRetention(id, visibleInvoicesWhere(user));
  if (!r) throw new AppError("NOT_FOUND", "المبلغ المحتجز غير موجود أو خارج نطاق صلاحيتك");
  if (r.releasedAt) throw new AppError("CONFLICT", "تم صرف هذا المبلغ من قبل");
  const type = r.type as HeldType;
  if (!releaseDocPresent(type, await repo.attachedDocCodes(r.invoiceId))) {
    throw new AppError("VALIDATION", `يلزم إرفاق مستند «${HELD_LABELS[type]}» على المستخلص قبل صرف المبلغ المحتجز`);
  }
  const at = new Date(`${input.date}T12:00:00Z`);
  if (Number.isNaN(at.getTime())) throw new AppError("VALIDATION", "تاريخ الصرف غير صحيح");

  const ctx = await getFlowContext();
  const inv = (await findInvoiceDetail(r.invoiceId, {}))!;
  const amount = formatMoney(r.amount);
  const recipients = await recipientsFor(ctx, inv, "company", user.id);
  const msgs = messagesFor(
    {
      kind: "retention_released",
      invoiceNo: inv.invoiceNo,
      companyName: inv.contract.company.name,
      aoNo: inv.ao.aoNo,
      pathName: inv.pathName,
      stepName: r.name,
      paymentRef: `${input.method} رقم ${input.ref}`,
      amount,
      note: input.note ?? null,
      url: `${env.appUrl}/invoices/${inv.id}`,
    },
    recipients,
  );
  let released = 0;
  const ok = await writeFlow({
    invoiceId: inv.id,
    expect: { status: "paid", currentStep: null },
    data: { updatedAt: new Date() },
    extra: async (tx) => {
      released = (await repo.releaseRetentionTx(tx, r.id, { ref: input.ref.trim(), method: input.method, note: input.note?.trim() || null, at, byId: user.id })).count;
      if (released !== 1) throw new AppError("CONFLICT", "تم صرف هذا المبلغ من قبل");
    },
    log: {
      action: "retention",
      fromStep: "done",
      toStep: "done",
      note: `صرف ${r.name} — ${amount} جنيه — ${input.method} رقم ${input.ref}${input.note ? `\n${input.note}` : ""}`,
      onBehalf: false,
      byId: user.id,
    },
    audit: { userId: user.id, action: "invoice.retention.release", details: { deduction: r.id, type, ref: input.ref } },
    ...msgs,
  });
  if (!ok) throw new AppError("CONFLICT");
  return { message: `تم صرف ${r.name} (${amount} جنيه)` };
}
