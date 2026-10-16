import "server-only";
import {
  commitmentState,
  compareMaterials,
  invoiceTotals,
  lineView,
  linesSummary,
  round2,
  suggestCategory,
  toCategoryLines,
  toTotalsLines,
  type CategorySuggestion,
  type CommitmentState,
  type DeductionInput,
  type InvoiceTotals,
  type LineView,
  type LinesSummary,
  type MaterialComparison,
} from "@it/domain";
import type { InvoiceDetail, RevisionContent } from "./invoice.repo";
import { grossByInvoiceOnAo, materialFigures, plannedByItem, plannedValue, prevQtyByItem } from "./invoice.repo";

/**
 * كل الأرقام المحسوبة لمستخلص (من @it/domain): البنود، المهمات، الإجماليات، الفئة المقترحة، الارتباط المالي.
 * الحسابات نفسها صافية في الدومين — الملف ده بيجمع الداتا ويحوّل Decimal ← number في الحدود بس.
 */

const n = (v: { toString(): string } | null | undefined): number | null => (v == null ? null : Number(v.toString()));

export type LineRow = LineView & { id: string; siteId: string | null };
export type MaterialRow = MaterialComparison & { id: string; materialId: string; description: string; unit: string };

export type InvoiceCalc = {
  lines: LineRow[];
  summary: LinesSummary;
  materials: MaterialRow[];
  totals: InvoiceTotals;
  suggestion: CategorySuggestion;
  /** قيمة أمر التكليف (المسجلة، أو قيمة الكميات المخططة) */
  aoValue: number;
  /** إجمالي المعتمد على أمر التكليف حتى هذا المستخلص (السابق + الحالي) */
  cumGross: number;
  commitment: CommitmentState | null;
};

type CalcInput = Pick<InvoiceDetail, "id" | "seq" | "migrated" | "migratedAmount" | "deductions" | "deductionsSet"> & {
  ao: Pick<InvoiceDetail["ao"], "id" | "value" | "financialCommitment">;
  contract: Pick<InvoiceDetail["contract"], "vatPct" | "payMonthlyPct" | "payAsbuiltPct" | "payHandoverPct" | "planningPayPct" | "taxPct">;
  workType: Pick<NonNullable<InvoiceDetail["workType"]>, "isPlanning"> | null;
};

export async function calcInvoice(inv: CalcInput, rev: RevisionContent | null): Promise<InvoiceCalc> {
  const [planned, prev, mats, grossRows, pv] = await Promise.all([
    plannedByItem(inv.ao.id),
    prevQtyByItem(inv.ao.id, inv.seq, inv.id),
    materialFigures(inv.ao.id, inv.seq, inv.id),
    grossByInvoiceOnAo(inv.ao.id),
    plannedValue(inv.ao.id),
  ]);

  const lines: LineRow[] = (rev?.lines ?? []).map((l) => {
    const key = l.contractItemId ?? `new:${l.newItemNo ?? ""}`;
    const ci = l.contractItem;
    return {
      id: l.id,
      siteId: l.site?.id ?? null,
      ...lineView({
        contractItemId: l.contractItemId,
        itemNo: ci?.itemNo ?? l.newItemNo ?? "—",
        description: ci?.description ?? l.newDescription ?? "",
        unit: ci?.unit ?? l.newUnit ?? null,
        workType: ci ? ci.workType : "بند مستجد",
        unitPrice: ci ? n(ci.unitPrice) : n(l.agreedPrice),
        qty: Number(l.qty),
        approvedQty: n(l.approvedQty),
        approveNote: l.approveNote,
        siteCode: l.site?.code ?? null,
        plannedQty: l.contractItemId ? (planned.get(l.contractItemId) ?? 0) : 0,
        prevQty: prev.get(key)?.qty ?? 0,
        inAo: l.contractItemId ? planned.has(l.contractItemId) : false,
      }),
    };
  });

  const materials: MaterialRow[] = compareMaterials(
    (rev?.materials ?? []).map((m) => ({
      code: m.material.code,
      planned: mats.planned.get(m.materialId) ?? 0,
      issued: mats.issued.get(m.materialId) ?? 0,
      prevExecuted: mats.prev.get(m.materialId) ?? 0,
      executed: Number(m.executedQty),
      billed: n(m.billedQty),
    })),
  ).map((c, i) => {
    const m = rev!.materials[i]!;
    return { ...c, id: m.id, materialId: m.materialId, description: m.material.description, unit: m.material.unit };
  });

  // بعد ما المالية تراجع الاستقطاعات (أو بعد السداد) الصفوف المحفوظة هي المعتمدة — قبلها القيم الافتراضية من العقد
  const deductionsOverride: DeductionInput[] | undefined = inv.deductionsSet
    ? inv.deductions.filter((d) => d.type !== "asbuilt" && d.type !== "handover").map((d) => ({ type: d.type, name: d.name, pct: n(d.pct), amount: n(d.amount) }))
    : undefined;
  const totals = invoiceTotals({
    lines: toTotalsLines(lines),
    isPlanning: inv.workType?.isPlanning ?? false,
    terms: {
      vatPct: Number(inv.contract.vatPct),
      payMonthlyPct: Number(inv.contract.payMonthlyPct),
      payAsbuiltPct: Number(inv.contract.payAsbuiltPct),
      payHandoverPct: Number(inv.contract.payHandoverPct),
      planningPayPct: Number(inv.contract.planningPayPct),
      taxPct: n(inv.contract.taxPct),
    },
    deductionsOverride,
  });

  const aoValue = n(inv.ao.value) ?? pv;
  const prevGross = grossRows.filter((g) => g.seq < inv.seq && g.id !== inv.id).reduce((a, g) => a + Number(g.gross), 0);
  const thisGross = inv.migrated ? (n(inv.migratedAmount) ?? 0) : totals.gross;
  const cumGross = round2(prevGross + thisGross);
  // الارتباط: كل المستخلصات المقدمة على أمر التكليف، والمستخلص ده بقيمته الحالية (حتى لو لسه مسودة)
  const billedAll = grossRows.filter((g) => g.id !== inv.id).reduce((a, g) => a + Number(g.gross), 0) + thisGross;
  const fc = n(inv.ao.financialCommitment);
  const commitment = aoValue > 0 || fc ? commitmentState({ aoValue, financialCommitment: fc, billedCumulative: billedAll }) : null;

  // الإجمالي التراكمي لبنود اتفوترت قبل كده ومش في المستخلص ده (عشان نسبة تجاوز أمر التكليف تبقى صحيحة)
  const inThis = new Set(lines.map((l) => l.contractItemId ?? `new:${l.itemNo}`));
  let otherCum = 0;
  for (const [key, p] of prev) if (!inThis.has(key)) otherCum += p.value;
  const suggestion = suggestCategory({ lines: toCategoryLines(lines), aoValue: aoValue > 0 ? aoValue : null, otherItemsCumulativeValue: round2(otherCum) });

  return { lines, summary: linesSummary(lines), materials, totals, suggestion, aoValue, cumGross, commitment };
}
