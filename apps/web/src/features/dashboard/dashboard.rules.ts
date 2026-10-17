/**
 * لوحة المؤشرات — حسابات صافية (من غير DB): البلاطات حسب الهيكل، وتقدم المستخلصات بالمراحل، ومستويات الألوان.
 */
import type { InvoiceStatus } from "@it/db";

type Ref = { id: string; name: string };
type ProjectOrg = { central: Ref & { dept: { generalDept: Ref } } } | null;
type Num = { toString(): string } | number | null;

export type DashInvoice = {
  status: InvoiceStatus;
  currentStep: string | null;
  heldAt: string | null;
  category: string | null;
  suggestedCategory: string | null;
  gross: number;
  ao: { id: string; project: ProjectOrg };
};

export type DashAo = { id: string; value: Num; project: ProjectOrg };

export const UNLINKED = "__unlinked";

export type Tile = { id: string; name: string; aoValue: number; billed: number; pct: number | null; invoices: number };

/** البلاطات: نسبة المفوتر من قيمة أوامر التكليف لكل إدارة عامة — أو لكل سنترال لو الإدارة العامة محددة */
export function orgTiles(invoices: DashInvoice[], aos: DashAo[], level: "generalDept" | "central"): Tile[] {
  const key = (p: ProjectOrg): Ref => (!p ? { id: UNLINKED, name: "غير مرتبط بالهيكل" } : level === "central" ? p.central : p.central.dept.generalDept);
  const tiles = new Map<string, Tile>();
  const get = (r: Ref) => {
    let t = tiles.get(r.id);
    if (!t) tiles.set(r.id, (t = { id: r.id, name: r.name, aoValue: 0, billed: 0, pct: null, invoices: 0 }));
    return t;
  };
  for (const a of aos) get(key(a.project)).aoValue += a.value == null ? 0 : Number(a.value.toString()) || 0;
  for (const i of invoices) {
    if (i.status === "draft") continue;
    const t = get(key(i.ao.project));
    t.billed += i.gross;
    t.invoices++;
  }
  return [...tiles.values()]
    .map((t) => ({ ...t, pct: t.aoValue > 0 ? (t.billed / t.aoValue) * 100 : null }))
    .sort((a, b) => (a.id === UNLINKED ? 1 : b.id === UNLINKED ? -1 : b.billed - a.billed));
}

/** مستوى اللون: أحمر < 25% ≤ كهرماني < 50% ≤ أزرق < 75% ≤ أخضر — null = مفيش قيمة أوامر تكليف */
export type Level = "cr" | "wa" | "in" | "ok" | "none";
export function levelOf(pct: number | null): Level {
  if (pct == null) return "none";
  if (pct < 25) return "cr";
  if (pct < 50) return "wa";
  if (pct < 75) return "in";
  return "ok";
}

export type CategoryPaths = Readonly<Record<string, readonly string[]>>;
export type StageProgress = { step: string; passed: number; pending: number };

/**
 * تقدم المستخلصات بالمراحل: لكل مرحلة، المستخلصات اللي مسارها بيعدي عليها — اجتازتها (passed) ولا لسه (pending).
 * المسار حسب الفئة المؤكدة أو المقترحة (أو C1). المسدد اجتاز كل مراحله، والمعاد/الموقوف عند مرحلته.
 */
export function stageProgress(invoices: DashInvoice[], paths: CategoryPaths, order: readonly string[]): StageProgress[] {
  const rows = new Map<string, StageProgress>(order.map((s) => [s, { step: s, passed: 0, pending: 0 }]));
  for (const i of invoices) {
    if (i.status === "draft") continue;
    const path = paths[i.category ?? i.suggestedCategory ?? "C1"] ?? paths.C1 ?? [];
    const at = i.status === "paid" ? path.length : Math.max(0, path.indexOf(i.heldAt ?? i.currentStep ?? path[0] ?? ""));
    path.forEach((s, idx) => {
      const r = rows.get(s);
      if (!r) return;
      if (idx < at) r.passed++;
      else r.pending++;
    });
  }
  return order.map((s) => rows.get(s)!).filter((r) => r.passed + r.pending > 0);
}

/** نسبة لعرض المؤشر الدائري (0–100) */
export const gaugePct = (v: number, max: number) => (max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0);
