import "server-only";
import {
  cycleDays,
  daysByStep,
  effectiveCategory,
  localDate,
  pathFor,
  slaState,
  stepSegments,
  totalSlaDays,
  type CycleDays,
  type SlaState,
} from "@it/domain";
import type { SessionUser } from "@/features/auth/auth.types";
import { hasRole, visibleInvoicesWhere } from "@/features/auth/scope";
import { listDocTypes } from "./draft.repo";
import { asCategory, flowAccess, type FlowAccess } from "./flow-access";
import { getFlowContext } from "./flow-config";
import { calcInvoice, type InvoiceCalc } from "./invoice-calc";
import {
  findInvoiceDetail,
  findRevisionContent,
  listActiveReturnReasons,
  listInvoiceEmails,
  requiredDocsFor,
  type InvoiceDetail,
  type RevisionContent,
} from "./invoice.repo";

export type PathStepView = { key: string; name: string; short: string; sla: number | null };

export type InvoiceView = {
  inv: InvoiceDetail;
  revision: RevisionContent | null;
  calc: InvoiceCalc;
  access: FlowAccess;
  path: PathStepView[];
  /** الفئة اللي المسار ماشي عليها + هل هي مبدئية (لسه ما اتحددتش) */
  pathCategory: string;
  tentative: boolean;
  totalSla: number;
  sla: SlaState;
  cycle: CycleDays;
  daysByStep: Record<string, number>;
  holder: string;
  steps: Record<string, { name: string; short: string }>;
  categories: { code: string; name: string; steps: number; sla: number }[];
  requiredDocs: { id: string; name: string; have: boolean }[];
  missingDocs: string[];
  returnReasons: { id: string; name: string }[];
  returnTargets: { key: string; label: string }[];
  emails: Awaited<ReturnType<typeof listInvoiceEmails>>;
  isCompany: boolean;
  /** أنواع المستندات (للمقاول أثناء الاستيفاء بس) */
  docTypes: { id: string; name: string }[];
};

export async function getInvoiceView(user: SessionUser, id: string): Promise<InvoiceView | null> {
  const ctx = await getFlowContext();
  const inv = await findInvoiceDetail(id, visibleInvoicesWhere(user));
  if (!inv) return null;
  const latest = inv.revisions[inv.revisions.length - 1];
  const isCompany = hasRole(user, "company");
  const [revision, access, docs, emails] = await Promise.all([
    latest ? findRevisionContent(latest.id) : null,
    flowAccess(user, inv, ctx),
    inv.ao.project ? requiredDocsFor(inv.ao.project.type.id) : [],
    isCompany ? Promise.resolve([]) : listInvoiceEmails(inv.id),
  ]);
  const calc = await calcInvoice(inv, revision);

  const cats = asCategory(inv);
  const cat = effectiveCategory({ category: cats.category, suggestedCategory: cats.suggestedCategory ?? calc.suggestion.category });
  const path = pathFor(ctx.config, cat).map((p) => ({
    key: p.step,
    name: ctx.config.steps[p.step]?.name ?? p.step,
    short: ctx.config.steps[p.step]?.short ?? p.step,
    sla: p.slaDays,
  }));

  const today = localDate(new Date());
  const end = inv.status === "paid" && inv.paidAt ? localDate(inv.paidAt) : today;
  const log = inv.log.map((e) => ({ action: e.action, fromStep: e.fromStep, toStep: e.toStep, at: localDate(e.at) }));
  const sla = slaState(
    { status: inv.status, since: localDate(inv.since), currentStep: inv.currentStep, ...cats, returnTo: inv.returnTo, holdReason: inv.holdReason },
    today,
    ctx.config,
    ctx.holidays,
    ctx.warnAt,
  );

  const short = (k: string | null) => (k ? (ctx.config.steps[k]?.short ?? k) : "—");
  const holder =
    inv.status === "paid" ? "—"
    : inv.status === "draft" ? "المقاول (مسودة)"
    : inv.status === "on_hold" ? `موقوف مؤقتاً — ${short(inv.heldAt ?? inv.currentStep)}`
    : inv.status === "returned" ? (inv.returnTo === "company" ? inv.contract.company.name : short(inv.returnTo))
    : short(inv.currentStep);

  const have = new Set((revision?.attachments ?? []).map((a) => a.docType?.id).filter(Boolean));
  const requiredDocs = docs.filter((d) => d.stage === "submit").map((d) => ({ id: d.docType.id, name: d.docType.name, have: have.has(d.docType.id) }));

  let returnTargets: { key: string; label: string }[] = [];
  let returnReasons: { id: string; name: string }[] = [];
  if (access.canReturn && inv.currentStep) {
    const i = path.findIndex((p) => p.key === inv.currentStep);
    returnTargets = [
      { key: "company", label: `${inv.contract.company.name} (المقاول)` },
      ...path.slice(0, Math.max(0, i)).map((p) => ({ key: p.key, label: p.name })),
    ];
    returnReasons = await listActiveReturnReasons();
  }

  return {
    inv,
    revision,
    calc,
    access,
    path,
    pathCategory: cat,
    tentative: !cats.category,
    totalSla: totalSlaDays(ctx.config, cat),
    sla,
    cycle: cycleDays(log, end, ctx.holidays),
    daysByStep: daysByStep(stepSegments(log, end, ctx.holidays)),
    holder,
    steps: Object.fromEntries(Object.entries(ctx.config.steps).map(([k, v]) => [k, { name: v.name, short: v.short }])),
    categories: Object.entries(ctx.config.categories).map(([code, c]) => ({
      code,
      name: c.name,
      steps: c.path.length,
      sla: c.path.reduce((a, p) => a + (p.slaDays ?? 0), 0),
    })),
    requiredDocs,
    missingDocs: requiredDocs.filter((d) => !d.have).map((d) => d.name),
    returnReasons,
    returnTargets,
    emails,
    isCompany,
    docTypes: access.companyResubmit ? await listDocTypes() : [],
  };
}
