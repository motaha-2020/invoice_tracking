/**
 * لوحة المؤشرات المالية — دوال صافية (من غير DB) عشان تتختبر.
 * المفوتر = كل المستخلصات عدا المسودات. الجاري = قيد الاعتماد + المعاد للاستيفاء + الموقوف مؤقتاً.
 * القيم غير شاملة الضريبة.
 */
import type { InvoiceStatus } from "@it/db";

type Ref = { id: string; name: string };
type ProjectRef = { id: string; code: string; name: string } | null;

export type InvoiceFact = {
  status: InvoiceStatus;
  currentStep: string | null;
  heldAt: string | null;
  gross: number;
  workType: { name: string } | null;
  contract: { id: string; contractNo: string; company: Ref };
  ao: { id: string; aoNo: string; project: ProjectRef };
};

export type AoFact = {
  id: string;
  value: { toString(): string } | number | null;
  financialCommitment: { toString(): string } | number | null;
  contract: { id: string; contractNo: string; company: Ref };
  project: ProjectRef;
};

export type ContractFact = { id: string; contractNo: string; title: string; contractValue: { toString(): string } | number | null; company: Ref };

const n = (v: { toString(): string } | number | null | undefined) => (v == null ? 0 : Number(v.toString()) || 0);

export type MoneyTotals = {
  contractValue: number;
  aoValue: number;
  commitment: number;
  billed: number;
  paid: number;
  pending: number;
  onHold: number;
  draft: number;
  /** قيمة أوامر التكليف − المفوتر */
  aoRemaining: number;
  invoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  aos: number;
  contracts: number;
};

export type StageSlice = { key: string; count: number; amount: number };

export type Group = {
  id: string;
  label: string;
  sub?: string;
  aoValue: number;
  billed: number;
  paid: number;
  pending: number;
  invoices: number;
  aos: number;
};

export type Insights = {
  totals: MoneyTotals;
  byStage: StageSlice[];
  byCompany: Group[];
  byContract: Group[];
  byProject: Group[];
  /** لكل أمر تكليف (المفتاح = id) */
  byAo: Map<string, Group>;
  byWorkType: { label: string; billed: number; count: number }[];
};

/** مفتاح موقع المستخلص: company (مسودة) / مرحلة الاعتماد / returned / hold / paid */
export function stageKey(i: Pick<InvoiceFact, "status" | "currentStep">): string {
  switch (i.status) {
    case "draft":
      return "company";
    case "paid":
      return "paid";
    case "on_hold":
      return "hold";
    case "returned":
      return "returned";
    default:
      return i.currentStep ?? "sup";
  }
}

const isPending = (s: InvoiceStatus) => s === "active" || s === "returned" || s === "on_hold";

function group(map: Map<string, Group>, id: string, label: string, sub?: string): Group {
  let g = map.get(id);
  if (!g) {
    g = { id, label, sub, aoValue: 0, billed: 0, paid: 0, pending: 0, invoices: 0, aos: 0 };
    map.set(id, g);
  }
  return g;
}

function addInvoice(g: Group, i: InvoiceFact) {
  if (i.status === "draft") return;
  g.invoices++;
  g.billed += i.gross;
  if (i.status === "paid") g.paid += i.gross;
  else if (isPending(i.status)) g.pending += i.gross;
}

const byBilled = (a: Group, b: Group) => b.billed - a.billed || b.aoValue - a.aoValue || a.label.localeCompare(b.label, "ar");

/** stepOrder = ترتيب مراحل الاعتماد (من إعدادات المسار) عشان المراحل تتعرض بترتيب الرحلة */
export function summarize(invoices: InvoiceFact[], aos: AoFact[], contracts: ContractFact[], stepOrder: readonly string[] = []): Insights {
  const t: MoneyTotals = {
    contractValue: contracts.reduce((a, c) => a + n(c.contractValue), 0),
    aoValue: 0, commitment: 0, billed: 0, paid: 0, pending: 0, onHold: 0, draft: 0, aoRemaining: 0,
    invoices: 0, paidInvoices: 0, pendingInvoices: 0, aos: aos.length, contracts: contracts.length,
  };
  const companies = new Map<string, Group>();
  const contractGroups = new Map<string, Group>();
  const projects = new Map<string, Group>();
  const aoGroups = new Map<string, Group>();
  const stages = new Map<string, StageSlice>();
  const workTypes = new Map<string, { label: string; billed: number; count: number }>();

  for (const c of contracts) group(contractGroups, c.id, c.contractNo, c.company.name);

  for (const a of aos) {
    const v = n(a.value);
    t.aoValue += v;
    t.commitment += n(a.financialCommitment ?? a.value);
    for (const g of [
      group(companies, a.contract.company.id, a.contract.company.name),
      group(contractGroups, a.contract.id, a.contract.contractNo, a.contract.company.name),
      ...(a.project ? [group(projects, a.project.id, a.project.name, a.project.code)] : []),
      group(aoGroups, a.id, a.id),
    ]) {
      g.aoValue += v;
      g.aos++;
    }
  }

  for (const i of invoices) {
    const k = stageKey(i);
    const s = stages.get(k) ?? { key: k, count: 0, amount: 0 };
    s.count++;
    s.amount += i.gross;
    stages.set(k, s);

    if (i.status === "draft") {
      t.draft += i.gross;
      continue;
    }
    t.invoices++;
    t.billed += i.gross;
    if (i.status === "paid") {
      t.paid += i.gross;
      t.paidInvoices++;
    } else if (isPending(i.status)) {
      t.pending += i.gross;
      t.pendingInvoices++;
      if (i.status === "on_hold") t.onHold += i.gross;
    }
    addInvoice(group(companies, i.contract.company.id, i.contract.company.name), i);
    addInvoice(group(contractGroups, i.contract.id, i.contract.contractNo, i.contract.company.name), i);
    if (i.ao.project) addInvoice(group(projects, i.ao.project.id, i.ao.project.name, i.ao.project.code), i);
    addInvoice(group(aoGroups, i.ao.id, i.ao.aoNo), i);
    const wt = i.workType?.name ?? "غير محدد";
    const w = workTypes.get(wt) ?? { label: wt, billed: 0, count: 0 };
    w.billed += i.gross;
    w.count++;
    workTypes.set(wt, w);
  }
  t.aoRemaining = t.aoValue - t.billed;

  const order = ["company", ...stepOrder, "returned", "hold", "paid"];
  const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length);
  return {
    totals: t,
    byStage: [...stages.values()].sort((a, b) => rank(a.key) - rank(b.key)),
    byCompany: [...companies.values()].sort(byBilled),
    byContract: [...contractGroups.values()].sort(byBilled),
    byProject: [...projects.values()].sort(byBilled),
    byAo: aoGroups,
    byWorkType: [...workTypes.values()].sort((a, b) => b.billed - a.billed),
  };
}

/** نسبة مئوية آمنة (0 لو المقام صفر) */
export const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
