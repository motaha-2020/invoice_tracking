import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui";
import { compact, Gauge, OrgTiles, StageBars, ValueCards } from "@/features/dashboard/components/dashboard-panels";
import { Slicers } from "@/features/dashboard/components/slicers";
import { getInvoiceDashboard } from "@/features/dashboard/dashboard.service";
import { StageBreakdown } from "@/features/insights/components/insights-cards";
import { activeFilterCount, parseFilter } from "@/features/reports/reports.filters";
import { requireNavAccess } from "@/features/shell/nav.service";
import { formatCount, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "لوحة المؤشرات" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireNavAccess("dashboard");
  const f = parseFilter(await searchParams);
  const d = await getInvoiceDashboard(user, f);
  const t = d.totals;
  const slaPct = d.sla.active ? (d.sla.onTime / d.sla.active) * 100 : 0;
  const n = activeFilterCount(f);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-p800 px-5 py-3 text-white">
        <h1 className="m-0 text-lg font-bold">لوحة مؤشرات المستخلصات</h1>
        <span className="text-xs text-p100">
          {n ? `${n} فلتر مطبق · ` : ""}القيم غير شاملة الضريبة · <span className="num">{formatDate(new Date())}</span>
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
        <Slicers f={f} o={d.options} />

        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <OrgTiles tiles={d.tiles} level={d.tileLevel} f={f} />
            <StageBars rows={d.progress} names={d.stepNames} t={t} />
          </div>

          <ValueCards t={t} />

          <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2">
            <Gauge title="المفوتر" value={t.billed} max={t.aoValue} display={compact(t.billed)} maxDisplay={compact(t.aoValue)} />
            <Gauge title="المسدد" value={t.paid} max={t.billed} display={compact(t.paid)} maxDisplay={compact(t.billed)} tone="ok" />
            <Gauge title="المستخلصات المسددة" value={t.paidInvoices} max={t.invoices} display={formatCount(t.paidInvoices)} maxDisplay={formatCount(t.invoices)} />
            <Gauge
              title="ضمن المدة المستهدفة"
              value={d.sla.onTime}
              max={d.sla.active}
              display={d.sla.active ? `${slaPct.toFixed(0)}%` : "—"}
              maxDisplay={`${formatCount(d.sla.active)} قيد المراجعة`}
              tone={slaPct >= 80 ? "ok" : slaPct >= 60 ? "wa" : "cr"}
            />
          </div>

          <StageBreakdown stages={d.byStage} names={Object.fromEntries(Object.entries(d.stepNames).map(([k, name]) => [k, { name }]))} />
        </div>
      </div>
    </>
  );
}
