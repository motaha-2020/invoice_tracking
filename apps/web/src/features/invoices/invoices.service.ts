import "server-only";
import type { InvoiceStatus, Prisma, Role } from "@it/db";
import { can } from "@/features/auth/permissions";
import { localDate, slaState, type CategoryCode, type SlaState } from "@it/domain";
import { cache } from "react";
import type { SessionUser } from "@/features/auth/auth.types";
import { inboxWhere, visibleInvoicesWhere, type StepRoleMap } from "@/features/auth/scope";
import { getFlowContext, isCategoryCode } from "./flow-config";
import { countByStatus, countInvoices, grossByIds, listInvoices, listWorkflowSteps, type InvoiceListRow as Row } from "./invoices.repo";

/** صف في قوائم المستخلصات + حالة المدة المستهدفة والقيمة المعتمدة */
export type InvoiceListRow = Row & { sla: SlaState; gross: number };

/** يضيف الـ SLA (بأيام العمل والعطلات) والقيمة لكل صف */
async function enrich(rows: Row[]): Promise<InvoiceListRow[]> {
  const [ctx, gross] = await Promise.all([getFlowContext(), grossByIds(rows.map((r) => r.id))]);
  const today = localDate(new Date());
  const cat = (v: string | null): CategoryCode | null => (isCategoryCode(v) ? v : null);
  return rows.map((r) => ({
    ...r,
    gross: gross.get(r.id) ?? 0,
    sla: slaState(
      { status: r.status, since: localDate(r.since), currentStep: r.currentStep, category: cat(r.category), suggestedCategory: cat(r.suggestedCategory), returnTo: r.returnTo, holdReason: r.holdReason },
      today,
      ctx.config,
      ctx.holidays,
      ctx.warnAt,
    ),
  }));
}

/** الأكثر تأخراً أولاً: الأيام المنقضية − المدة المستهدفة */
export function lateness(r: InvoiceListRow): number {
  return r.sla.elapsed == null ? -999 : r.sla.elapsed - (r.sla.sla ?? 3);
}

/** المحطات (مرة لكل request) */
export const getWorkflowSteps = cache(listWorkflowSteps);

export type StepInfo = { name: string; short: string };

/** خريطة المحطة ← الدور + الأسماء */
const getStepMaps = cache(async () => {
  const steps = await getWorkflowSteps();
  const roles: Record<string, Role> = {};
  const names: Record<string, StepInfo> = {};
  for (const s of steps) {
    roles[s.key] = s.role;
    names[s.key] = { name: s.name, short: s.short };
  }
  return { roles: roles as StepRoleMap, names };
});

export async function getStepNames(): Promise<Record<string, StepInfo>> {
  return (await getStepMaps()).names;
}

/**
 * صندوق الوارد: المستخلصات اللي الدور فيها على المستخدم.
 * صاحب التجاوز الإداري (PMO / Admin) بيشوف كل المفتوح في نطاقه عشان يقدر يحرّك بالنيابة.
 */
const inboxFor = cache(async (user: SessionUser): Promise<Prisma.InvoiceWhereInput> => {
  const { roles } = await getStepMaps();
  const turn = inboxWhere(user, roles);
  if (!(await can(user, "invoice.override"))) return turn;
  return { OR: [turn, { AND: [visibleInvoicesWhere(user), { status: { in: ["active", "returned", "on_hold"] } }] }] };
});

/** عدد المستخلصات اللي مستنية المستخدم (للـ sidebar والرئيسية) */
export const countInbox = cache(async (user: SessionUser): Promise<number> => countInvoices(await inboxFor(user)));

export async function listInbox(user: SessionUser): Promise<InvoiceListRow[]> {
  const rows = await enrich(await listInvoices(await inboxFor(user)));
  return rows.sort((a, b) => lateness(b) - lateness(a));
}

const STATUSES: InvoiceStatus[] = ["draft", "active", "returned", "on_hold", "paid"];

export function parseStatus(v: unknown): InvoiceStatus | undefined {
  return typeof v === "string" && (STATUSES as string[]).includes(v) ? (v as InvoiceStatus) : undefined;
}

export async function listVisibleInvoices(user: SessionUser, filter: { status?: InvoiceStatus; step?: string } = {}): Promise<InvoiceListRow[]> {
  const where: Prisma.InvoiceWhereInput[] = [visibleInvoicesWhere(user)];
  if (filter.status) where.push({ status: filter.status });
  if (filter.step) where.push({ currentStep: filter.step });
  return enrich(await listInvoices(where.length === 1 ? where[0]! : { AND: where }, { take: 1000 }));
}

/** مستخلصات في نطاق المستخدم بشرط إضافي (صفحة الشركة / المشروع) */
export async function listInvoicesWhere(user: SessionUser, where: Prisma.InvoiceWhereInput, take = 1000): Promise<InvoiceListRow[]> {
  return enrich(await listInvoices({ AND: [visibleInvoicesWhere(user), where] }, { take }));
}

/** المستخلصات المتجاوزة للمدة أو التي قاربت على الانتهاء (للرئيسية) */
export async function listSlaAlerts(user: SessionUser): Promise<InvoiceListRow[]> {
  const rows = await enrich(await listInvoices({ AND: [visibleInvoicesWhere(user), { status: "active" }] }, { take: 500 }));
  return rows.filter((r) => r.sla.k === "late" || r.sla.k === "due").sort((a, b) => lateness(b) - lateness(a)).slice(0, 15);
}

export type HomeStats = {
  byStatus: Record<InvoiceStatus, number>;
  total: number;
  inbox: number;
};

export async function getHomeStats(user: SessionUser): Promise<HomeStats> {
  const [counts, inbox] = await Promise.all([countByStatus(visibleInvoicesWhere(user)), countInbox(user)]);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, counts[s] ?? 0])) as Record<InvoiceStatus, number>;
  return { byStatus, total: STATUSES.reduce((a, s) => a + byStatus[s], 0), inbox };
}
