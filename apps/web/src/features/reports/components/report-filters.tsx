"use client";

import { FileDown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { buttonClasses, Input, Select } from "@/components/ui";
import { filterQuery, type ReportFilter } from "../reports.filters";
import type { FilterOptions } from "../reports.service";

type Props = { filter: ReportFilter; options: FilterOptions; canExport: boolean; count: number };

/** مسح المستويات الأدنى لما الأعلى يتغير (الهيكل متدرج) */
const CHILDREN: Record<string, (keyof ReportFilter)[]> = {
  company: ["contract"],
  presidency: ["sector", "generalDept", "dept", "central", "project"],
  sector: ["generalDept", "dept", "central", "project"],
  generalDept: ["dept", "central", "project"],
  dept: ["central", "project"],
  central: ["project"],
};

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] items-center gap-2";

/** شريط الفلاتر: كل تغيير بيحدّث الرابط، والتصدير بيستخدم نفس الفلتر بالظبط */
export function ReportFilters({ filter, options: o, canExport, count }: Props) {
  const router = useRouter();
  const set = (key: keyof ReportFilter, value: string) => {
    const next: ReportFilter = { ...filter, [key]: value || undefined };
    for (const c of CHILDREN[key] ?? []) delete next[c];
    const qs = filterQuery(next);
    router.push(qs ? `/reports?${qs}` : "/reports", { scroll: false });
  };
  const sel = (key: keyof ReportFilter, label: string, items: { id: string; name: string }[]) => (
    <Select aria-label={label} value={filter[key] ?? ""} onChange={(e) => set(key, e.target.value)}>
      <option value="">{label}: الكل</option>
      {items.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
    </Select>
  );
  // كل مستوى بيتفلتر باللي فوقه
  const sectors = o.sectors.filter((s) => !filter.presidency || s.presidencyId === filter.presidency);
  const gds = o.generalDepts.filter((g) => (!filter.sector ? sectors.some((s) => s.id === g.sectorId) : g.sectorId === filter.sector));
  const depts = o.depts.filter((d) => (!filter.generalDept ? gds.some((g) => g.id === d.generalDeptId) : d.generalDeptId === filter.generalDept));
  const centrals = o.centrals.filter((c) => (!filter.dept ? depts.some((d) => d.id === c.deptId) : c.deptId === filter.dept));
  const projects = o.projects.filter((p) => (!filter.central ? centrals.some((c) => c.id === p.centralId) : p.centralId === filter.central));
  const contracts = o.contracts.filter((c) => !filter.company || c.companyId === filter.company).map((c) => ({ id: c.id, name: c.contractNo }));
  const qs = filterQuery(filter);

  return (
    <div className="flex flex-col gap-2 border-b border-bd1 px-[18px] py-3 max-sm:px-3">
      <div className={GRID}>
        {o.companies.length > 1 && sel("company", "المقاول", o.companies)}
        {sel("contract", "العقد", contracts)}
        {sel("presidency", "رئاسة القطاعات", o.presidencies)}
        {sel("sector", "القطاع", sectors)}
        {sel("generalDept", "الإدارة العامة", gds)}
        {sel("dept", "الإدارة المختصة", depts)}
        {sel("central", "السنترال", centrals)}
        {sel("project", "المشروع", projects)}
      </div>
      <div className={GRID}>
        <Select aria-label="الحالة" value={filter.status ?? ""} onChange={(e) => set("status", e.target.value)}>
          <option value="">الحالة: الكل</option>
          <option value="open">مفتوح (لم يُسدَّد)</option>
          <option value="active">قيد المراجعة</option>
          <option value="returned">معاد للاستيفاء</option>
          <option value="on_hold">موقوف مؤقتاً</option>
          <option value="paid">تم السداد</option>
        </Select>
        <Select aria-label="الفئة" value={filter.category ?? ""} onChange={(e) => set("category", e.target.value)}>
          <option value="">الفئة: الكل</option>
          {["C1", "C2", "C3", "C4", "C5"].map((c) => <option key={c}>{c}</option>)}
        </Select>
        <label className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-tx2">
          التقديم من
          <Input type="date" dir="ltr" value={filter.from ?? ""} onChange={(e) => set("from", e.target.value)} />
        </label>
        <label className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-tx2">
          إلى
          <Input type="date" dir="ltr" value={filter.to ?? ""} onChange={(e) => set("to", e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {qs && (
          <button type="button" className={buttonClasses({ size: "sm", variant: "gh" })} onClick={() => router.push("/reports", { scroll: false })}>
            <X /> مسح الفلاتر
          </button>
        )}
        <span className="ms-auto" />
        {canExport && (
          <a href={`/api/reports/export${qs ? `?${qs}` : ""}`} className={buttonClasses({ variant: "pr", size: "sm" })} aria-disabled={count === 0}>
            <FileDown /> تصدير Excel (<span className="num">{count}</span> مستخلص)
          </a>
        )}
      </div>
    </div>
  );
}
