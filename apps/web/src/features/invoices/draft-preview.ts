import {
  checkLineRows,
  checkMaterialRows,
  compareMaterials,
  invoiceTotals,
  lineView,
  linesSummary,
  round2,
  suggestCategory,
  toCategoryLines,
  toTotalsLines,
  type CategorySuggestion,
  type InvoiceTotals,
  type LineCheckResult,
  type LineView,
  type MaterialCheckResult,
  type MaterialComparison,
} from "@it/domain";
import type { AoWorkspace, LineRowState, MaterialRowState } from "./draft.types";

/**
 * معاينة المستخلص قبل الحفظ — نفس الحسابات اللي السيرفر بيعملها (من @it/domain)،
 * بس على الداتا اللي اتحملت للمعالج، فبتشتغل فورياً في المتصفح.
 */

export type DraftPreview = {
  lineCheck: LineCheckResult;
  materialCheck: MaterialCheckResult;
  lines: LineView[];
  materials: (MaterialComparison & { description: string; unit: string })[];
  gross: number;
  submitted: number;
  totals: InvoiceTotals;
  suggestion: CategorySuggestion;
};

export function lineContext(ws: Pick<AoWorkspace, "items" | "planned" | "sites">, defaultSite: string | null) {
  return {
    items: new Map(ws.items.map((i) => [i.itemNo, { id: i.id, isGroup: i.isGroup, unitPrice: i.unitPrice }])),
    aoItemIds: new Set(Object.keys(ws.planned)),
    sites: new Set(ws.sites.map((s) => s.code)),
    defaultSite,
  };
}

export function catalogMap(ws: Pick<AoWorkspace, "catalog">): Map<string, string> {
  return new Map(ws.catalog.map((m) => [m.code, m.id]));
}

export function previewDraft(ws: AoWorkspace, rows: LineRowState[], mats: MaterialRowState[], opts: { defaultSite: string | null; isPlanning: boolean }): DraftPreview {
  const lineCheck = checkLineRows(rows, lineContext(ws, opts.defaultSite));
  const materialCheck = checkMaterialRows(mats, catalogMap(ws));
  const byId = new Map(ws.items.map((i) => [i.id, i]));

  const lines = lineCheck.lines.map((l) => {
    const it = byId.get(l.contractItemId)!;
    return lineView({
      contractItemId: it.id,
      itemNo: it.itemNo,
      description: it.description,
      unit: it.unit,
      workType: it.workType,
      unitPrice: it.unitPrice,
      qty: l.qty,
      approvedQty: null,
      siteCode: l.siteCode,
      plannedQty: ws.planned[it.id] ?? 0,
      prevQty: ws.prev[it.id]?.qty ?? 0,
      inAo: it.id in ws.planned,
    });
  });

  const catalog = new Map(ws.catalog.map((m) => [m.id, m]));
  const materials = compareMaterials(
    materialCheck.mats.map((m) => ({
      code: m.code,
      planned: ws.matPlanned[m.materialId] ?? 0,
      issued: ws.matIssued[m.materialId] ?? 0,
      prevExecuted: ws.matPrev[m.materialId] ?? 0,
      executed: m.executedQty,
    })),
  ).map((c, i) => {
    const cat = catalog.get(materialCheck.mats[i]!.materialId)!;
    return { ...c, description: cat.description, unit: cat.unit };
  });

  const summary = linesSummary(lines);
  const totals = invoiceTotals({ lines: toTotalsLines(lines), isPlanning: opts.isPlanning, terms: ws.terms });
  const inThis = new Set(lines.map((l) => l.contractItemId));
  const other = Object.entries(ws.prev).reduce((a, [k, p]) => (inThis.has(k) ? a : a + p.value), 0);
  const suggestion = suggestCategory({ lines: toCategoryLines(lines), aoValue: ws.ao.value > 0 ? ws.ao.value : null, otherItemsCumulativeValue: round2(other) });

  return { lineCheck, materialCheck, lines, materials, gross: summary.gross, submitted: summary.submitted, totals, suggestion };
}

/** الموانع قبل التقديم (رقم الخطوة + الرسالة) */
export function draftBlockers(
  p: { invoiceNo: string; pathName: string; workTypeId: string; aoId: string },
  preview: DraftPreview | null,
  requiredDocs: { id: string; name: string }[],
  attachedDocTypes: ReadonlySet<string>,
): { step: number; text: string }[] {
  const out: { step: number; text: string }[] = [];
  if (!p.aoId) out.push({ step: 1, text: "يرجى اختيار أمر التكليف" });
  if (!p.invoiceNo.trim()) out.push({ step: 1, text: "يرجى إدخال رقم المستخلص" });
  if (!p.pathName.trim()) out.push({ step: 1, text: "يرجى إدخال اسم المسار" });
  if (!p.workTypeId) out.push({ step: 1, text: "يرجى اختيار نوع الأعمال" });
  if (preview) {
    if (!preview.lineCheck.lines.length) out.push({ step: 2, text: "لا توجد بنود أعمال صحيحة في المستخلص" });
    if (preview.lineCheck.err) out.push({ step: 2, text: `يوجد ${preview.lineCheck.err} صف في البنود به أخطاء` });
    if (preview.materialCheck.err) out.push({ step: 3, text: `يوجد ${preview.materialCheck.err} صف في المهمات به أخطاء` });
  }
  for (const d of requiredDocs) if (!attachedDocTypes.has(d.id)) out.push({ step: 4, text: `مستند إلزامي غير مرفق: ${d.name}` });
  return out;
}
