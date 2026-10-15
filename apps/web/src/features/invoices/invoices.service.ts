import "server-only";
import type { InvoiceStatus, Role } from "@it/db";
import { cache } from "react";
import type { SessionUser } from "@/features/auth/auth.types";
import { inboxWhere, visibleInvoicesWhere, type StepRoleMap } from "@/features/auth/scope";
import { countByStatus, countInvoices, listInvoices, listWorkflowSteps, type InvoiceListRow } from "./invoices.repo";

export type { InvoiceListRow } from "./invoices.repo";

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

/** عدد المستخلصات اللي مستنية المستخدم (للـ sidebar والرئيسية) */
export const countInbox = cache(async (user: SessionUser): Promise<number> => {
  const { roles } = await getStepMaps();
  return countInvoices(inboxWhere(user, roles));
});

export async function listInbox(user: SessionUser): Promise<InvoiceListRow[]> {
  const { roles } = await getStepMaps();
  return listInvoices(inboxWhere(user, roles));
}

const STATUSES: InvoiceStatus[] = ["draft", "active", "returned", "on_hold", "paid"];

export function parseStatus(v: unknown): InvoiceStatus | undefined {
  return typeof v === "string" && (STATUSES as string[]).includes(v) ? (v as InvoiceStatus) : undefined;
}

export async function listVisibleInvoices(user: SessionUser, filter: { status?: InvoiceStatus } = {}): Promise<InvoiceListRow[]> {
  const scope = visibleInvoicesWhere(user);
  return listInvoices(filter.status ? { AND: [scope, { status: filter.status }] } : scope);
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
