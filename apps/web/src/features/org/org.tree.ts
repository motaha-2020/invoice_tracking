/**
 * شجرة الهيكل التنظيمي — دوال صافية (client-safe): الأبناء، المسار، تجميع العدّادات لفوق، والبحث.
 */
import { ORG_LEVELS, PARENT_LEVEL, type OrgLevel } from "./org.kinds";

export type FlatNode = { kind: OrgLevel; id: string; code: string; name: string; parentId: string | null };
export type NodeCounts = { projects: number; invoices: number };

export const nodeKey = (kind: OrgLevel, id: string) => `${kind}:${id}`;

export function parentKeyOf(n: Pick<FlatNode, "kind" | "parentId">): string | null {
  const p = PARENT_LEVEL[n.kind];
  return p && n.parentId ? nodeKey(p, n.parentId) : null;
}

export type OrgIndex<T extends FlatNode = FlatNode> = {
  byKey: ReadonlyMap<string, T>;
  /** مفتاح الأب ← الأبناء (بالترتيب: الشئون الفنية قبل الإدارات العامة، وبعدين بالاسم) */
  children: ReadonlyMap<string, T[]>;
  roots: T[];
};

const levelOrder = (k: OrgLevel) => ORG_LEVELS.indexOf(k);
const byLevelThenName = (a: FlatNode, b: FlatNode) =>
  levelOrder(a.kind) - levelOrder(b.kind) || a.name.localeCompare(b.name, "ar") || a.code.localeCompare(b.code);

export function buildIndex<T extends FlatNode>(nodes: readonly T[]): OrgIndex<T> {
  const byKey = new Map<string, T>();
  const children = new Map<string, T[]>();
  const roots: T[] = [];
  for (const n of nodes) byKey.set(nodeKey(n.kind, n.id), n);
  for (const n of nodes) {
    const pk = parentKeyOf(n);
    if (!pk) {
      roots.push(n);
      continue;
    }
    const list = children.get(pk) ?? [];
    list.push(n);
    children.set(pk, list);
  }
  roots.sort(byLevelThenName);
  for (const list of children.values()) list.sort(byLevelThenName);
  return { byKey, children, roots };
}

/** المسار من الرئاسة لحد العقدة نفسها (شامل) */
export function pathOf<T extends FlatNode>(index: OrgIndex<T>, kind: OrgLevel, id: string): T[] {
  const out: T[] = [];
  let cur = index.byKey.get(nodeKey(kind, id));
  const guard = new Set<string>();
  while (cur) {
    const k = nodeKey(cur.kind, cur.id);
    if (guard.has(k)) break;
    guard.add(k);
    out.unshift(cur);
    const pk = parentKeyOf(cur);
    cur = pk ? index.byKey.get(pk) : undefined;
  }
  return out;
}

/**
 * عدّادات كل عقدة: السنترال من مشروعاته، وكل مستوى فوقه = مجموع اللي تحته.
 * الشئون الفنية مالهاش مشروعات (بتراجع القطاع كله) فعدّادها صفر.
 */
export function rollupCounts(nodes: readonly FlatNode[], perCentral: ReadonlyMap<string, NodeCounts>): Map<string, NodeCounts> {
  const out = new Map<string, NodeCounts>();
  for (const n of nodes) out.set(nodeKey(n.kind, n.id), { projects: 0, invoices: 0 });
  for (const n of nodes) {
    if (n.kind !== "central") continue;
    const c = perCentral.get(n.id);
    if (c) out.set(nodeKey("central", n.id), { ...c });
  }
  // من تحت لفوق: سنترال ← إدارة ← إدارة عامة ← قطاع ← رئاسة
  for (const level of ["central", "dept", "generalDept", "sector"] as const) {
    for (const n of nodes) {
      if (n.kind !== level) continue;
      const pk = parentKeyOf(n);
      const parent = pk ? out.get(pk) : undefined;
      const mine = out.get(nodeKey(n.kind, n.id))!;
      if (parent) {
        parent.projects += mine.projects;
        parent.invoices += mine.invoices;
      }
    }
  }
  return out;
}

/** البحث: العقد اللي تطابق (اسم أو كود) + كل أجدادها عشان تبان في الشجرة. q فاضي = null (كله ظاهر) */
export function visibleKeys(index: OrgIndex<FlatNode>, q: string): Set<string> | null {
  const term = q.trim().toLowerCase();
  if (!term) return null;
  const keep = new Set<string>();
  for (const [k, n] of index.byKey) {
    if (!`${n.name} ${n.code}`.toLowerCase().includes(term)) continue;
    keep.add(k);
    let pk = parentKeyOf(n);
    while (pk && !keep.has(pk)) {
      keep.add(pk);
      const p = index.byKey.get(pk);
      pk = p ? parentKeyOf(p) : null;
    }
  }
  return keep;
}
