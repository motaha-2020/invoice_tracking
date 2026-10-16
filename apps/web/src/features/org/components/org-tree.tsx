"use client";

import { ChevronDown, ChevronLeft, ChevronsDown, ChevronsUp, Network, SearchX } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button, Card, CardFooter, CardHeader, EmptyState, Input, Num } from "@/components/ui";
import { cn } from "@/lib/cn";
import { KIND_LABELS, ORG_LEVELS } from "../org.kinds";
import type { OrgNodeRow, ProjectRow } from "../org.service";
import { buildIndex, nodeKey, pathOf, visibleKeys, type OrgIndex } from "../org.tree";
import { AddButton } from "./org-buttons";
import { KIND_ICONS } from "./org-icons";
import { NodeDetail } from "./node-detail";

type Props = { nodes: OrgNodeRow[]; projects: ProjectRow[] };

/** شجرة الهيكل (يمين) + تفاصيل العقدة المختارة (شمال) — زي الديمو */
export function OrgTree({ nodes, projects }: Props) {
  const index = useMemo(() => buildIndex(nodes), [nodes]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(index.roots.map((r) => nodeKey(r.kind, r.id))));
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const visible = useMemo(() => visibleKeys(index, q), [index, q]);
  const detailRef = useRef<HTMLDivElement>(null);

  const toggle = (k: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const select = (k: string) => {
    setSelected(k);
    // افتح الأجداد عشان العقدة تبان في الشجرة
    setOpen((s) => {
      const n = new Set(s);
      const node = index.byKey.get(k);
      if (node) for (const p of pathOf(index, node.kind, node.id)) n.add(nodeKey(p.kind, p.id));
      return n;
    });
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const selectedNode = selected ? (index.byKey.get(selected) ?? null) : null;

  if (!nodes.length) {
    return (
      <Card>
        <EmptyState icon={Network} title="لسه مفيش هيكل" action={<AddButton kind="presidency" label="أول رئاسة قطاعات" />}>
          <div className="text-[13px]">ابدأ بإضافة رئاسة قطاعات، أو ارفع قالب الهيكل التنظيمي من تبويب &quot;استيراد&quot;.</div>
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-start gap-4 max-xl:grid-cols-1">
      <Card>
        <CardHeader
          title="شجرة الهيكل"
          actions={
            <>
              <Button variant="gh" size="sm" onClick={() => setOpen(new Set(nodes.map((n) => nodeKey(n.kind, n.id))))}>
                <ChevronsDown aria-hidden /> فتح الكل
              </Button>
              <Button variant="gh" size="sm" onClick={() => setOpen(new Set())}>
                <ChevronsUp aria-hidden /> قفل الكل
              </Button>
            </>
          }
        />
        <div className="border-b border-bd1 px-[18px] py-2.5 max-sm:px-3">
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="دوّر باسم أو كود…" aria-label="بحث في الهيكل" />
        </div>
        <div role="tree" aria-label="الهيكل التنظيمي" className="max-h-[640px] overflow-y-auto p-2">
          {visible && visible.size === 0 ? (
            <EmptyState icon={SearchX} title="مفيش نتايج">
              <div className="text-[13px]">جرّب كلمة تانية</div>
            </EmptyState>
          ) : (
            index.roots.map((r) => (
              <TreeNode key={r.id} node={r} depth={0} ctx={{ index, open, visible, selected, toggle, select }} />
            ))
          )}
        </div>
        <CardFooter className="flex flex-wrap gap-x-4 gap-y-1">
          {ORG_LEVELS.map((l) => {
            const Icon = KIND_ICONS[l];
            return (
              <span key={l} className="inline-flex items-center gap-1">
                <Icon className="size-3.5" aria-hidden /> {KIND_LABELS[l].one}
              </span>
            );
          })}
        </CardFooter>
      </Card>
      <div ref={detailRef} className="scroll-mt-20">
        <NodeDetail node={selectedNode} index={index} projects={projects} onSelect={select} />
      </div>
    </div>
  );
}

type Ctx = {
  index: OrgIndex<OrgNodeRow>;
  open: Set<string>;
  visible: Set<string> | null;
  selected: string | null;
  toggle: (k: string) => void;
  select: (k: string) => void;
};

function TreeNode({ node, depth, ctx }: { node: OrgNodeRow; depth: number; ctx: Ctx }) {
  const key = nodeKey(node.kind, node.id);
  if (ctx.visible && !ctx.visible.has(key)) return null;
  const kids = ctx.index.children.get(key) ?? [];
  const isOpen = ctx.visible ? true : ctx.open.has(key);
  const isSel = ctx.selected === key;
  const Icon = KIND_ICONS[node.kind];
  return (
    <>
      <div
        role="treeitem"
        aria-level={depth + 1}
        aria-selected={isSel}
        aria-expanded={kids.length ? isOpen : undefined}
        tabIndex={0}
        onClick={() => ctx.select(key)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            ctx.select(key);
          } else if (kids.length && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
            // RTL: الشمال = فتح، اليمين = قفل
            e.preventDefault();
            if ((e.key === "ArrowLeft") !== isOpen) ctx.toggle(key);
          }
        }}
        style={{ paddingInlineStart: 4 + depth * 20 }}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded-base py-1 pe-2 text-sm outline-offset-[-2px] hover:bg-hover focus-visible:outline-2 focus-visible:outline-p500",
          isSel && "bg-sel font-semibold text-brand-tx hover:bg-sel",
        )}
      >
        {kids.length ? (
          <Button
            variant="gh"
            size="sm"
            icon
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              ctx.toggle(key);
            }}
            aria-label={`${isOpen ? "قفل" : "فتح"} ${node.name}`}
          >
            {isOpen ? <ChevronDown /> : <ChevronLeft />}
          </Button>
        ) : (
          <span className="w-7 shrink-0" aria-hidden />
        )}
        <Icon className={cn("size-4 shrink-0", node.kind === "techUnit" ? "text-in6" : "text-brand-tx")} strokeWidth={1.75} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <span className="num shrink-0 text-xs text-tx3 max-sm:hidden">{node.code}</span>
        {node.invoices > 0 && (
          <span className="shrink-0 rounded-sm bg-id1 px-1.5 text-xs font-semibold text-tx2" title="مستخلصات">
            <Num>{node.invoices}</Num>
          </span>
        )}
      </div>
      {isOpen && kids.map((k) => <TreeNode key={k.id} node={k} depth={depth + 1} ctx={ctx} />)}
    </>
  );
}
