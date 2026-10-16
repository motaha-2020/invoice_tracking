import "server-only";
import { commitmentState, round2, type CommitmentState } from "@it/domain";
import type { AoStatus } from "@it/db";
import type { SessionUser } from "@/features/auth/auth.types";
import { contractsScopeWhere, itemLevel, termsSummary } from "./contracts.rules";
import {
  billedByAo,
  billedQtyByItem,
  findAoDetail,
  findContract,
  listContracts,
  sumAoValueByContract,
  type AoDetail,
  type ContractDetail,
} from "./contracts.repo";

/** Decimal / string / null ← number | null (الحدود بس — زي القاعدة 6 في architecture.md) */
const n = (v: { toString(): string } | null | undefined): number | null => (v == null ? null : Number(v.toString()));

export type ContractSummary = {
  id: string;
  contractNo: string;
  title: string;
  currency: string;
  companyId: string;
  companyName: string;
  contractValue: number | null;
  items: number;
  aos: number;
  aoTotal: number;
  billed: number;
  terms: string;
};

export async function listContractsFor(user: SessionUser): Promise<ContractSummary[]> {
  const rows = await listContracts(contractsScopeWhere(user));
  const ids = rows.map((r) => r.id);
  const [aoTotals, billed] = await Promise.all([sumAoValueByContract(ids), billedByAo(ids)]);
  const billedBy = new Map<string, number>();
  for (const b of billed) billedBy.set(b.contractId, (billedBy.get(b.contractId) ?? 0) + Number(b.billed));
  return rows.map((r) => ({
    id: r.id,
    contractNo: r.contractNo,
    title: r.title,
    currency: r.currency,
    companyId: r.company.id,
    companyName: r.company.name,
    contractValue: n(r.contractValue),
    items: r._count.items,
    aos: r._count.assignmentOrders,
    aoTotal: Number(aoTotals.get(r.id) ?? 0),
    billed: round2(billedBy.get(r.id) ?? 0),
    terms: termsSummary({ payMonthlyPct: Number(r.payMonthlyPct), payAsbuiltPct: Number(r.payAsbuiltPct), payHandoverPct: Number(r.payHandoverPct) }),
  }));
}

export type BoqRow = {
  id: string;
  itemNo: string;
  level: number;
  isGroup: boolean;
  description: string;
  unit: string | null;
  contractQty: number | null;
  unitPrice: number | null;
  workType: string | null;
};

export type AoSummary = {
  id: string;
  aoNo: string;
  name: string;
  status: AoStatus;
  project: string | null;
  projectId: string | null;
  central: string | null;
  value: number | null;
  financialCommitment: number | null;
  commitment: CommitmentState | null;
  sites: number;
  invoices: number;
};

export type ContractView = {
  contract: Omit<ContractDetail, "items" | "assignmentOrders">;
  terms: string;
  boq: BoqRow[];
  aos: AoSummary[];
  stats: { items: number; groups: number; unpriced: number; aoTotal: number; billed: number };
};

export async function getContractView(user: SessionUser, id: string): Promise<ContractView | null> {
  const c = await findContract(id, contractsScopeWhere(user));
  if (!c) return null;
  const billed = new Map((await billedByAo([c.id])).map((b) => [b.aoId, b]));
  const { items, assignmentOrders, ...contract } = c;
  const boq = items.map((i) => ({
    id: i.id,
    itemNo: i.itemNo,
    level: itemLevel(i.itemNo),
    isGroup: i.isGroup,
    description: i.description,
    unit: i.unit,
    contractQty: n(i.contractQty),
    unitPrice: n(i.unitPrice),
    workType: i.workType,
  }));
  const aos = assignmentOrders.map((a): AoSummary => {
    const b = billed.get(a.id);
    const value = n(a.value);
    const fc = n(a.financialCommitment);
    return {
      id: a.id,
      aoNo: a.aoNo,
      name: a.name,
      status: a.status,
      project: a.project?.name ?? null,
      projectId: a.project?.id ?? null,
      central: a.project?.central.name ?? a.centralText,
      value,
      financialCommitment: fc,
      commitment: value != null || fc != null ? commitmentState({ aoValue: value ?? 0, financialCommitment: fc, billedCumulative: Number(b?.billed ?? 0) }) : null,
      sites: a._count.sites,
      invoices: b?.invoices ?? 0,
    };
  });
  return {
    contract,
    terms: termsSummary({ payMonthlyPct: Number(c.payMonthlyPct), payAsbuiltPct: Number(c.payAsbuiltPct), payHandoverPct: Number(c.payHandoverPct) }),
    boq,
    aos,
    stats: {
      items: boq.filter((i) => !i.isGroup).length,
      groups: boq.filter((i) => i.isGroup).length,
      unpriced: boq.filter((i) => !i.isGroup && i.unitPrice == null).length,
      aoTotal: round2(aos.reduce((s, a) => s + (a.value ?? 0), 0)),
      billed: round2([...billed.values()].reduce((s, b) => s + Number(b.billed), 0)),
    },
  };
}

export type AoItemView = {
  id: string;
  itemNo: string;
  description: string;
  unit: string | null;
  site: string | null;
  unitPrice: number | null;
  planned: number;
  billed: number;
  over: boolean;
  sortOrder: number;
};

export type AoView = {
  ao: Omit<AoDetail, "items">;
  commitment: CommitmentState | null;
  billedValue: number;
  items: AoItemView[];
  plannedValue: number;
};

export async function getAoView(user: SessionUser, contractId: string, aoId: string): Promise<AoView | null> {
  const ao = await findAoDetail(contractId, aoId, contractsScopeWhere(user));
  if (!ao) return null;
  const [billedRows, aoBilled] = await Promise.all([billedQtyByItem(ao.id), billedByAo([contractId])]);
  const billedQty = new Map(billedRows.map((r) => [`${r.contractItemId}|${r.siteId ?? ""}`, Number(r.qty)]));
  const { items: raw, ...rest } = ao;
  const items = raw
    .map((i): AoItemView => {
      const planned = Number(i.plannedQty);
      const billed = billedQty.get(`${i.contractItem.id}|${i.siteId ?? ""}`) ?? 0;
      return {
        id: i.id,
        itemNo: i.contractItem.itemNo,
        description: i.contractItem.description,
        unit: i.contractItem.unit,
        site: i.site?.code ?? null,
        unitPrice: n(i.contractItem.unitPrice),
        planned,
        billed,
        over: billed > planned + 1e-9,
        sortOrder: i.contractItem.sortOrder,
      };
    })
    .sort((a, b) => (a.site ?? "").localeCompare(b.site ?? "", "en", { numeric: true }) || a.sortOrder - b.sortOrder);
  const billedValue = Number(aoBilled.find((b) => b.aoId === ao.id)?.billed ?? 0);
  const value = n(ao.value);
  const fc = n(ao.financialCommitment);
  return {
    ao: rest,
    commitment: value != null || fc != null ? commitmentState({ aoValue: value ?? 0, financialCommitment: fc, billedCumulative: billedValue }) : null,
    billedValue: round2(billedValue),
    items,
    plannedValue: round2(items.reduce((s, i) => s + i.planned * (i.unitPrice ?? 0), 0)),
  };
}
