import "server-only";
import { compareMaterials, type MaterialFlag } from "@it/domain";
import type { SessionUser } from "@/features/auth/auth.types";
import { aoScopeWhere } from "./ao-scope";
import {
  comparisonData,
  listAoOptions,
  listIssues,
  listMaterialOptions,
  materialsByIds,
  searchMaterials,
  type IssueFilter,
} from "./materials.repo";

/** الكميات Decimal(18,4) ← number في الحدود دي بس */
const q = (v: { toString(): string } | null | undefined) => (v == null ? 0 : Number(v));
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export function getCatalog(search: string | undefined) {
  return searchMaterials(search?.trim() || undefined);
}

/** خيارات الفلاتر (في نطاق المستخدم) */
export async function getFilterOptions(user: SessionUser) {
  const [aos, materials] = await Promise.all([listAoOptions(aoScopeWhere(user)), listMaterialOptions()]);
  const contracts = new Map<string, { id: string; label: string }>();
  for (const a of aos) {
    if (!contracts.has(a.contractId)) contracts.set(a.contractId, { id: a.contractId, label: `${a.contract.contractNo} — ${a.contract.company.name}` });
  }
  return {
    contracts: [...contracts.values()],
    aos: aos.map((a) => ({ id: a.id, contractId: a.contractId, label: `${a.aoNo} — ${a.name}` })),
    materials: materials.map((m) => ({ id: m.id, label: `${m.code} — ${m.description}` })),
  };
}

export async function getIssues(user: SessionUser, f: IssueFilter) {
  const [rows, total] = await listIssues(aoScopeWhere(user), f);
  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      date: r.issueDate,
      ref: r.issueRef,
      contractNo: r.ao.contract.contractNo,
      company: r.ao.contract.company.name,
      aoNo: r.ao.aoNo,
      aoName: r.ao.name,
      code: r.material.code,
      description: r.material.description,
      unit: r.material.unit,
      qty: q(r.qty),
      returned: q(r.returnedQty),
    })),
  };
}

export type ComparisonRow = {
  key: string;
  aoNo: string;
  aoName: string;
  contractNo: string;
  code: string;
  description: string;
  unit: string;
  planned: number;
  issued: number;
  executed: number;
  billed: number;
  balance: number;
  flags: MaterialFlag[];
};

/**
 * لكل أمر تكليف × صنف: المخطط (أمر التكليف) ↔ المنصرف (− المرتجع) ↔ المنفذ والمفوتر
 * (آخر نسخة من كل مستخلص مش مسودة). التنبيهات من compareMaterials في @it/domain.
 */
export async function getComparison(user: SessionUser, f: IssueFilter): Promise<{ rows: ComparisonRow[]; truncated: boolean }> {
  const LIMIT = 100;
  const aos = await comparisonData(aoScopeWhere(user), f, LIMIT + 1);
  const truncated = aos.length > LIMIT;
  const list = aos.slice(0, LIMIT);

  const ids = new Set<string>();
  const perAo = list.map((a) => {
    const add = (m: Map<string, number>, id: string, n: number) => {
      ids.add(id);
      m.set(id, (m.get(id) ?? 0) + n);
    };
    const planned = new Map<string, number>();
    const issued = new Map<string, number>();
    const executed = new Map<string, number>();
    const billed = new Map<string, number>();
    for (const m of a.materials) add(planned, m.materialId, q(m.plannedQty));
    for (const x of a.issues) add(issued, x.materialId, q(x.qty) - q(x.returnedQty));
    for (const inv of a.invoices) {
      for (const m of inv.revisions[0]?.materials ?? []) {
        add(executed, m.materialId, q(m.executedQty));
        add(billed, m.materialId, m.billedQty == null ? q(m.executedQty) : q(m.billedQty));
      }
    }
    const matIds = [...new Set([...planned.keys(), ...issued.keys(), ...executed.keys()])];
    return { a, matIds, planned, issued, executed, billed };
  });

  const mats = new Map((await materialsByIds([...ids])).map((m) => [m.id, m]));
  const rows: ComparisonRow[] = [];
  for (const { a, matIds, planned, issued, executed, billed } of perAo) {
    const sorted = matIds.sort((x, y) => (mats.get(x)?.code ?? "").localeCompare(mats.get(y)?.code ?? "", "en", { numeric: true }));
    const cmp = compareMaterials(
      sorted.map((id) => ({
        code: id,
        planned: round4(planned.get(id) ?? 0),
        issued: round4(issued.get(id) ?? 0),
        // المقارنة هنا على مستوى أمر التكليف كله: كل المنفذ "سابق" ومفيش مستخلص حالي
        prevExecuted: round4(executed.get(id) ?? 0),
        executed: 0,
        billed: round4(billed.get(id) ?? 0),
      })),
    );
    for (const c of cmp) {
      const m = mats.get(c.code);
      rows.push({
        key: `${a.id}|${c.code}`,
        aoNo: a.aoNo,
        aoName: a.name,
        contractNo: a.contract.contractNo,
        code: m?.code ?? "—",
        description: m?.description ?? "",
        unit: m?.unit ?? "",
        planned: c.planned,
        issued: c.issued,
        executed: c.cumExecuted,
        billed: c.billed,
        balance: c.balance,
        flags: c.flags,
      });
    }
  }
  return { rows, truncated };
}
