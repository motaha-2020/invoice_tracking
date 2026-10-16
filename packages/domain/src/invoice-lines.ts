import type { CategoryLine } from './category';
import { round2 } from './money';
import type { TotalsLine } from './totals';

/*
 * بنود المستخلص كما تُعرض للمراجعين: السعر من العقد، والسابق والتراكمي والمخطط والتجاوز.
 *
 *   approvedQty = الكمية المعتمدة (ولو لسه ما اتعدلتش = المقدمة)
 *   cumQty      = prevQty + approvedQty         ← السابق = المعتمد في المستخلصات الأقدم على نفس أمر التكليف
 *   overQty     = max(0, cumQty − plannedQty)
 *   overPct     = (cumQty − plannedQty) / plannedQty × 100   (100% لو البند مش في أمر التكليف)
 *   total       = approvedQty × unitPrice      (null لو البند من غير سعر)
 */

export interface LineInput {
  /** بند العقد (null = بند مستجد) */
  contractItemId: string | null;
  itemNo: string;
  description: string;
  unit: string | null;
  workType: string | null;
  /** سعر العقد، أو السعر المتفق عليه للبند المستجد، أو null */
  unitPrice: number | null;
  qty: number;
  approvedQty: number | null;
  approveNote?: string | null;
  siteCode?: string | null;
  /** إجمالي كمية البند في أمر التكليف (كل المواقع) — 0 لو مش موجود */
  plannedQty: number;
  /** المعتمد من البند في المستخلصات السابقة على نفس أمر التكليف */
  prevQty: number;
  /** البند موجود في كميات أمر التكليف؟ */
  inAo: boolean;
}

export interface LineView extends LineInput {
  approvedQty: number;
  isNew: boolean;
  notInAo: boolean;
  cumQty: number;
  overQty: number;
  overPct: number;
  submittedTotal: number | null;
  total: number | null;
  changed: boolean;
}

const EPS = 1e-9;
const roundQty = (n: number): number => Math.round(n * 10_000) / 10_000;

export function lineView(l: LineInput): LineView {
  const approved = l.approvedQty ?? l.qty;
  const cumQty = roundQty(l.prevQty + approved);
  const overQty = Math.max(0, roundQty(cumQty - l.plannedQty));
  const overPct = l.plannedQty > 0 ? ((cumQty - l.plannedQty) / l.plannedQty) * 100 : cumQty > 0 ? 100 : 0;
  return {
    ...l,
    approvedQty: approved,
    isNew: l.contractItemId == null,
    notInAo: l.contractItemId != null && !l.inAo,
    cumQty,
    overQty,
    overPct,
    submittedTotal: l.unitPrice == null ? null : round2(l.qty * l.unitPrice),
    total: l.unitPrice == null ? null : round2(approved * l.unitPrice),
    changed: l.approvedQty != null && Math.abs(l.approvedQty - l.qty) > EPS,
  };
}

/**
 * البنود مجمعة لكل بند عقد (نفس البند ممكن يتكرر على أكتر من موقع) — لحساب الفئة.
 * التجاوز بيتحسب على مستوى البند كله في أمر التكليف مش لكل موقع.
 */
export function toCategoryLines(views: readonly LineView[]): CategoryLine[] {
  const byKey = new Map<string, CategoryLine>();
  for (const v of views) {
    const key = v.contractItemId ?? `new:${v.itemNo}`;
    const cur = byKey.get(key);
    if (cur) cur.approvedQty = roundQty(cur.approvedQty + v.approvedQty);
    else {
      byKey.set(key, {
        itemNo: v.itemNo, unitPrice: v.unitPrice, isNew: v.isNew,
        plannedQty: v.plannedQty, prevQty: v.prevQty, approvedQty: v.approvedQty,
      });
    }
  }
  return [...byKey.values()];
}

export function toTotalsLines(views: readonly LineView[]): TotalsLine[] {
  return views.map((v) => ({ unitPrice: v.unitPrice, approvedQty: v.approvedQty, workType: v.workType }));
}

export interface LinesSummary {
  gross: number;
  submitted: number;
  unpriced: number;
  over: number;
  changed: number;
}

export function linesSummary(views: readonly LineView[]): LinesSummary {
  let grossC = 0;
  let subC = 0;
  for (const v of views) {
    grossC += Math.round((v.total ?? 0) * 100);
    subC += Math.round((v.submittedTotal ?? 0) * 100);
  }
  return {
    gross: grossC / 100,
    submitted: subC / 100,
    unpriced: views.filter((v) => v.unitPrice == null).length,
    over: views.filter((v) => v.overQty > 0).length,
    changed: views.filter((v) => v.changed).length,
  };
}
