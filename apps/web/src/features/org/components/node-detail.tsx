"use client";

import { ChevronLeft, MousePointerClick } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, Num } from "@/components/ui";
import { CHILD_LEVELS, KIND_LABELS, PARENT_FIELD, type OrgLevel } from "../org.kinds";
import type { OrgNodeRow, ProjectRow } from "../org.service";
import { nodeKey, pathOf, type OrgIndex } from "../org.tree";
import { AddButton, RowActions } from "./org-buttons";
import type { DeleteTarget, EntityRecord } from "./org-dialogs";
import { KIND_ICONS } from "./org-icons";

type Props = {
  node: OrgNodeRow | null;
  index: OrgIndex<OrgNodeRow>;
  projects: ProjectRow[];
  onSelect: (key: string) => void;
};

/** قيم فورم التعديل لعقدة في الهيكل */
export function nodeRecord(n: OrgNodeRow): EntityRecord & DeleteTarget {
  const rec: EntityRecord & DeleteTarget = { id: n.id, code: n.code, name: n.name };
  const pf = PARENT_FIELD[n.kind];
  if (pf && n.parentId) rec[pf] = n.parentId;
  return rec;
}

export function projectRecord(p: ProjectRow): EntityRecord & DeleteTarget {
  return { id: p.id, code: p.code, name: p.name, typeId: p.typeId, centralId: p.centralId, startDate: p.startDate ?? "", notes: p.notes ?? "" };
}

export function NodeDetail({ node, index, projects, onSelect }: Props) {
  if (!node) {
    return (
      <Card>
        <EmptyState icon={MousePointerClick} title="يرجى اختيار مستوى من الشجرة">
          <div className="text-[13px]">تُعرض تفاصيل المستوى والمستويات التابعة له، مع إمكانية التعديل أو الإضافة.</div>
        </EmptyState>
      </Card>
    );
  }
  const key = nodeKey(node.kind, node.id);
  const path = pathOf(index, node.kind, node.id);
  const parent = path.length > 1 ? path[path.length - 2] : null;
  const kids = index.children.get(key) ?? [];
  const Icon = KIND_ICONS[node.kind];
  const childLevels = CHILD_LEVELS[node.kind];
  const myProjects = node.kind === "central" ? projects.filter((p) => p.centralId === node.id) : [];

  return (
    <Card>
      <CardHeader
        title={<span className="break-words">{node.name}</span>}
        actions={<RowActions kind={node.kind} record={nodeRecord(node)} />}
      >
        <Badge tone="p" className="order-first">
          <Icon className="size-3.5" aria-hidden /> {KIND_LABELS[node.kind].one}
        </Badge>
      </CardHeader>
      <CardBody className="space-y-4">
        <nav aria-label="الموقع في الهيكل التنظيمي" className="flex flex-wrap items-center gap-1 text-xs text-tx3">
          {path.map((p, i) => (
            <Fragment key={p.id}>
              {i > 0 && <ChevronLeft className="size-3" aria-hidden />}
              {i < path.length - 1 ? (
                <button type="button" className="cursor-pointer hover:text-brand-tx" onClick={() => onSelect(nodeKey(p.kind, p.id))}>
                  {p.name}
                </button>
              ) : (
                <span className="text-tx2">{p.name}</span>
              )}
            </Fragment>
          ))}
        </nav>

        <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kv label="الكود"><Num>{node.code}</Num></Kv>
          <Kv label="يتبع">{parent ? parent.name : "—"}</Kv>
          <Kv label="مشروعات"><Num>{node.projects}</Num></Kv>
          <Kv label="مستخلصات"><Num>{node.invoices}</Num></Kv>
        </dl>

        {node.kind === "techUnit" && (
          <Alert tone="i">
            تراجع الشئون الفنية مستخلصات القطاع بالكامل ({parent?.name ?? "—"}).
          </Alert>
        )}

        {(childLevels.length > 0 || node.kind === "central") && (
          <div className="flex flex-wrap gap-2">
            {childLevels.map((k) => (
              <AddButton key={k} kind={k} variant="default" size="sm" defaults={{ [PARENT_FIELD[k]!]: node.id }} />
            ))}
            {node.kind === "central" && <AddButton kind="project" variant="default" size="sm" defaults={{ centralId: node.id }} />}
          </div>
        )}

        {childLevels.map((k) => (
          <ChildList key={k} level={k} list={kids.filter((x) => x.kind === k)} onSelect={onSelect} />
        ))}

        {node.kind === "central" && (
          <section>
            <h4 className="mb-1.5 text-[13px] font-semibold text-tx2">
              المشروعات <Num className="text-tx3">({myProjects.length})</Num>
            </h4>
            {myProjects.length ? (
              <ul className="m-0 list-none divide-y divide-bd1 rounded-base border border-bd1 p-0">
                {myProjects.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <KIND_ICONS.project className="size-4 shrink-0 text-brand-tx" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <Badge>{p.typeName}</Badge>
                    <span className="num text-xs text-tx3">{p.code}</span>
                    <RowActions kind="project" record={projectRecord(p)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-xs text-tx3">لا توجد مشروعات على هذا السنترال بعد</p>
            )}
          </section>
        )}
      </CardBody>
    </Card>
  );
}

function Kv({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-base bg-hover px-3 py-2">
      <dt className="text-xs text-tx3">{label}</dt>
      <dd className="m-0 truncate text-sm font-semibold">{children}</dd>
    </div>
  );
}

function ChildList({ level, list, onSelect }: { level: OrgLevel; list: OrgNodeRow[]; onSelect: (k: string) => void }) {
  const Icon = KIND_ICONS[level];
  return (
    <section>
      <h4 className="mb-1.5 text-[13px] font-semibold text-tx2">
        {KIND_LABELS[level].many} <Num className="text-tx3">({list.length})</Num>
      </h4>
      {list.length ? (
        <ul className="m-0 list-none divide-y divide-bd1 rounded-base border border-bd1 p-0">
          {list.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => onSelect(nodeKey(x.kind, x.id))}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-start text-sm hover:bg-hover"
              >
                <Icon className="size-4 shrink-0 text-brand-tx" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{x.name}</span>
                <span className="num text-xs text-tx3">{x.code}</span>
                <span className="text-xs text-tx3">
                  <Num>{x.invoices}</Num> مستخلص
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-xs text-tx3">لم تُسجَّل {KIND_LABELS[level].many} التابعة بعد</p>
      )}
    </section>
  );
}
