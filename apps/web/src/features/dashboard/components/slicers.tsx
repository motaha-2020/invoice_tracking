"use client";

import { FilterX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import type { ReportFilter } from "@/features/reports/reports.filters";
import type { FilterOptions } from "@/features/reports/reports.service";

type Opt = { id: string; name: string; parent?: string };
type Key = keyof ReportFilter;

/** الأبناء اللي بيتمسحوا لما الأب يتغير */
const CHILDREN: Partial<Record<Key, Key[]>> = {
  presidency: ["sector", "generalDept", "dept", "central", "project"],
  sector: ["generalDept", "dept", "central", "project"],
  generalDept: ["dept", "central", "project"],
  dept: ["central", "project"],
  central: ["project"],
  company: ["contract"],
};

const YEARS = [2025, 2026, 2027];
const STATUS: { v: NonNullable<ReportFilter["status"]>; label: string }[] = [
  { v: "open", label: "مفتوح" },
  { v: "paid", label: "مسدد" },
  { v: "on_hold", label: "موقوف" },
  { v: "returned", label: "معاد" },
];

export function Slicers({ f, o }: { f: ReportFilter; o: FilterOptions }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const go = (patch: Partial<ReportFilter>) => {
    const next: ReportFilter = { ...f, ...patch };
    for (const k of Object.keys(patch) as Key[]) for (const c of CHILDREN[k] ?? []) delete next[c];
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    start(() => router.push(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false }));
  };

  const under = (list: Opt[], parent: string | undefined) => (parent ? list.filter((x) => x.parent === parent) : list);
  const sectors = under(o.sectors.map((x) => ({ id: x.id, name: x.name, parent: x.presidencyId })), f.presidency);
  const gds = under(o.generalDepts.map((x) => ({ id: x.id, name: x.name, parent: x.sectorId })), f.sector);
  const depts = under(o.depts.map((x) => ({ id: x.id, name: x.name, parent: x.generalDeptId })), f.generalDept);
  const centrals = under(o.centrals.map((x) => ({ id: x.id, name: x.name, parent: x.deptId })), f.dept);
  const projects = under(o.projects.map((x) => ({ id: x.id, name: x.name, parent: x.centralId })), f.central);
  const contracts = under(o.contracts.map((x) => ({ id: x.id, name: x.contractNo, parent: x.companyId })), f.company);
  const year = YEARS.find((y) => f.from === `${y}-01-01` && f.to === `${y}-12-31`);

  return (
    <aside aria-label="فلاتر لوحة المؤشرات" className={cn("space-y-2 transition-opacity", pending && "opacity-60")}>
      <Slicer label="رئاسة القطاعات" k="presidency" list={o.presidencies} f={f} go={go} />
      <Slicer label="القطاع" k="sector" list={sectors} f={f} go={go} />
      <Slicer label="الإدارة العامة" k="generalDept" list={gds} f={f} go={go} />
      <Slicer label="الإدارة المختصة" k="dept" list={depts} f={f} go={go} />
      <Slicer label="السنترال" k="central" list={centrals} f={f} go={go} />
      <Slicer label="المشروع" k="project" list={projects} f={f} go={go} />
      <Slicer label="المقاول" k="company" list={o.companies} f={f} go={go} />
      <Slicer label="العقد" k="contract" list={contracts} f={f} go={go} />

      <Chips label="الحالة" items={STATUS.map((s) => ({ key: s.v, label: s.label, on: f.status === s.v, set: () => go({ status: f.status === s.v ? undefined : s.v }) }))} cols={2} />
      <Chips
        label="فئة التجاوز"
        items={["C1", "C2", "C3", "C4", "C5"].map((c) => ({ key: c, label: c, on: f.category === c, set: () => go({ category: f.category === c ? undefined : c }) }))}
        cols={5}
      />
      <Chips
        label="سنة التقديم"
        items={YEARS.map((y) => ({
          key: String(y),
          label: String(y),
          on: year === y,
          set: () => go(year === y ? { from: undefined, to: undefined } : { from: `${y}-01-01`, to: `${y}-12-31` }),
        }))}
        cols={3}
      />
      <button
        type="button"
        onClick={() => start(() => router.push("/dashboard", { scroll: false }))}
        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-base border border-bd2 bg-card text-[13px] text-tx2 hover:bg-hover"
      >
        <FilterX className="size-4" aria-hidden /> مسح كل الفلاتر
      </button>
    </aside>
  );
}

function Slicer({ label, k, list, f, go }: { label: string; k: Key; list: Opt[]; f: ReportFilter; go: (p: Partial<ReportFilter>) => void }) {
  const id = `sl-${k}`;
  const on = !!f[k];
  return (
    <div className={cn("rounded-md border px-2.5 py-2", on ? "border-brand bg-brand-soft" : "border-p100 bg-p50")}>
      <label htmlFor={id} className="mb-1 flex items-center justify-between text-[13px] font-semibold text-brand-tx">
        {label}
        <span className="num text-xs font-normal text-tx3">{list.length}</span>
      </label>
      <select
        id={id}
        value={f[k] ?? ""}
        onChange={(e) => go({ [k]: e.target.value || undefined })}
        className="h-8 w-full rounded-base border border-bd2 bg-card px-2 text-[13px] text-tx"
      >
        <option value="">الكل</option>
        {list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
    </div>
  );
}

function Chips({ label, items, cols }: { label: string; items: { key: string; label: string; on: boolean; set: () => void }[]; cols: number }) {
  return (
    <div className="rounded-md border border-p100 bg-p50 px-2.5 py-2">
      <div className="mb-1 text-[13px] font-semibold text-brand-tx">{label}</div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            aria-pressed={it.on}
            onClick={it.set}
            className={cn(
              "num h-7 rounded-base border text-xs font-medium",
              it.on ? "border-brand bg-brand text-white" : "border-bd2 bg-card text-tx2 hover:border-brand",
            )}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}
