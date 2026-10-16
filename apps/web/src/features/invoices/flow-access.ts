import "server-only";
import { effectiveCategory, nextStep } from "@it/domain";
import type { SessionUser } from "@/features/auth/auth.types";
import { can } from "@/features/auth/permissions";
import { hasRole, inboxWhere, scopeWhere } from "@/features/auth/scope";
import { isCategoryCode, type FlowContext } from "./flow-config";
import { invoiceMatches, type InvoiceDetail } from "./invoice.repo";

/**
 * مين يقدر يعمل إيه على المستخلص دلوقتي:
 * - صاحب الدور: المستخلص في صندوق وارده (inboxWhere) — مرحلته الحالية أو معاد له.
 * - التجاوز الإداري (invoice.override): يحرّك بالنيابة عن أي جهة، وبيتسجل كده في السجل.
 * - الإيقاف المؤقت: التجاوز الإداري أو الشئون الفنية في نطاقها.
 */

/** المراحل اللي ينفع فيها تعديل الكمية المعتمدة للبنود */
export const QTY_EDIT_STEPS: readonly string[] = ["sup", "exec", "tech"];

export type FlowAccess = {
  /** الدور على المستخدم ده دلوقتي (المرحلة الحالية بتاعته، أو المستخلص معاد له) */
  turn: boolean;
  /** تجاوز إداري (PMO / Admin): يقدر يحرّك بالنيابة عن الجهة */
  override: boolean;
  canApprove: boolean;
  canPay: boolean;
  canReturn: boolean;
  canCategory: boolean;
  canResubmit: boolean;
  /** إعادة التقديم من المقاول (نسخة جديدة بالمرفقات / البنود المعدلة) */
  companyResubmit: boolean;
  canHold: boolean;
  canRelease: boolean;
  canEditQty: boolean;
};

const NONE: FlowAccess = {
  turn: false, override: false, canApprove: false, canPay: false, canReturn: false, canCategory: false,
  canResubmit: false, companyResubmit: false, canHold: false, canRelease: false, canEditQty: false,
};

type FlowInvoice = Pick<InvoiceDetail, "id" | "status" | "currentStep" | "category" | "suggestedCategory" | "returnTo">;

export async function flowAccess(user: SessionUser, inv: FlowInvoice, ctx: FlowContext): Promise<FlowAccess> {
  const [inScope, turn, overridePerm] = await Promise.all([
    invoiceMatches(inv.id, scopeWhere(user)),
    invoiceMatches(inv.id, inboxWhere(user, ctx.stepRoles)),
    can(user, "invoice.override"),
  ]);
  if (!inScope || inv.status === "paid" || inv.status === "draft") return NONE;
  const override = overridePerm && ["active", "returned", "on_hold"].includes(inv.status);
  const act = turn || override;
  const holdOk = override || hasRole(user, "tech_affairs");
  const active = inv.status === "active";
  let isLast = false;
  if (active && inv.currentStep) {
    try {
      isLast = nextStep(ctx.config, effectiveCategory(asCategory(inv)), inv.currentStep) === null;
    } catch {
      isLast = false;
    }
  }
  const key = inv.status === "returned" ? inv.returnTo : inv.currentStep;
  return {
    turn,
    override: override && !turn,
    canApprove: act && active && !isLast,
    canPay: act && active && isLast,
    canReturn: act && active,
    canCategory: act && active && inv.currentStep === "exec",
    canResubmit: act && inv.status === "returned",
    companyResubmit: act && inv.status === "returned" && inv.returnTo === "company",
    canHold: holdOk && active,
    canRelease: holdOk && inv.status === "on_hold",
    canEditQty: act && (active || inv.status === "returned") && key != null && QTY_EDIT_STEPS.includes(key),
  };
}

export function asCategory(inv: Pick<InvoiceDetail, "category" | "suggestedCategory">) {
  return {
    category: isCategoryCode(inv.category) ? inv.category : null,
    suggestedCategory: isCategoryCode(inv.suggestedCategory) ? inv.suggestedCategory : null,
  };
}

