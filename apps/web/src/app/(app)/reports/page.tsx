import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert, Badge, Card, CardHeader, CategoryBadge, EmptyState, Money, Num, PageHeader, PageSkeleton, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { can } from "@/features/auth/permissions";
import { Bar, KpiTile } from "@/features/reports/components/report-charts";
import { ReportFilters } from "@/features/reports/components/report-filters";
import { activeFilterCount, parseFilter } from "@/features/reports/reports.filters";
import { buildReport, getFilterOptions } from "@/features/reports/reports.service";
import { requireNavAccess } from "@/features/shell/nav.service";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "التقارير والمؤشرات" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const TABLE_ROWS = 100;

export default function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReportsContent searchParams={searchParams} />
    </Suspense>
  );
}

const fmtPct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);

async function ReportsContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireNavAccess("reports");
  const filter = parseFilter(await searchParams);
  const [report, options, canExport] = await Promise.all([buildReport(user, filter), getFilterOptions(user), can(user, "reports.export")]);
  const { kpis: k, rows } = report;
  const billedPct = report.aoValueTotal > 0 ? (k.grossSubmitted / report.aoValueTotal) * 100 : null;
  const sla = k.slaCompliance.pct;
  const late = rows.filter((r) => r.sla.k === "late").length;
  const stepMaxDays = Math.max(1, ...k.byStep.map((s) => s.avgDays));
  const agingMax = Math.max(1, ...k.aging.map((a) => a.count));
  const reasonsMax = Math.max(1, ...k.topReasons.map((r) => r.count));
  const companyMax = Math.max(1, ...report.byCompany.map((c) => c.gross));

  return (
    <>
      <PageHeader
        title="التقارير والمؤشرات"
        sub={<>مؤشرات أداء مسار المستخلصات ضمن نطاق صلاحيتك{activeFilterCount(filter) > 0 && <> · <Num>{activeFilterCount(filter)}</Num> فلتر مطبّق</>} — أيام العمل الرسمية</>}
        crumbs={[{ label: "الرئيسية", href: "/" }, { label: "التقارير والمؤشرات" }]}
      />
      <Card className="mb-4">
        <ReportFilters filter={filter} options={options} canExport={canExport} count={rows.length} />
      </Card>
      {report.truncated && <Alert tone="a" className="mb-4">عدد المستخلصات أكبر من حد العرض — يرجى تضييق الفلتر للحصول على نتائج كاملة.</Alert>}

      {rows.length === 0 ? (
        <Card><EmptyState title="لا توجد مستخلصات مطابقة للفلتر" /></Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
            <KpiTile label="المستخلصات المقدمة" value={k.submitted} hint={<>مفتوح <Num>{k.open}</Num> · مسدد <Num>{k.paid}</Num> · معاد <Num>{k.returned}</Num></>} />
            <KpiTile
              label="نسبة الالتزام بالمدة المستهدفة"
              value={fmtPct(sla)}
              tone={sla == null ? undefined : sla >= 90 ? "g" : sla >= 70 ? "a" : "r"}
              hint={<><Num>{k.slaCompliance.onTime}</Num> من <Num>{k.slaCompliance.total}</Num> مرحلة انتهت في الميعاد</>}
            />
            <KpiTile
              label="متوسط مدة الدورة"
              value={k.avgCycle == null ? "—" : k.avgCycle.toFixed(1)}
              unit="يوم عمل"
              hint={k.avgCycleBasis === "paid" ? "من التقديم حتى السداد (المسدد)" : "من التقديم حتى اليوم (لا يوجد مسدد)"}
            />
            <KpiTile label="نسبة الأيام لدى المقاول" value={fmtPct(k.companySharePct)} hint="من مدة الدورة، بعد الإعادة للاستيفاء" />
            <KpiTile
              label="نسبة الإعادة للاستيفاء"
              value={fmtPct(k.returnRate.pct)}
              tone={k.returnRate.pct == null ? undefined : k.returnRate.pct <= 20 ? "g" : k.returnRate.pct <= 40 ? "a" : "r"}
              hint={<><Num>{k.returnRate.returnedOnce}</Num> مستخلص أُعيد مرة أو أكثر</>}
            />
            <KpiTile label="إجمالي الأعمال المعتمدة" value={formatMoney(k.grossSubmitted, { decimals: 0 })} unit="جنيه" hint={<>منها مسدد <Num>{formatMoney(k.grossPaid, { decimals: 0 })}</Num></>} />
            <KpiTile label="المفوتر من قيمة أوامر التكليف" value={fmtPct(billedPct)} hint={<>قيمة أوامر التكليف <Num>{formatMoney(report.aoValueTotal, { decimals: 0 })}</Num></>} />
            <KpiTile
              label="متجاوز للمدة الآن"
              value={late}
              tone={late ? "r" : "g"}
              hint={<>في المرحلة الحالية · موقوف مؤقتاً <Num>{k.onHold}</Num></>}
            />
          </div>

          <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card>
              <CardHeader title="الأداء حسب مرحلة الاعتماد" sub="المراحل المنتهية — أين يتأخر المسار؟" />
              <TableWrap>
                <Table className="text-[13px]">
                  <THead>
                    <tr><Th>المرحلة</Th><Th align="end">مرات المرور</Th><Th>متوسط الأيام</Th><Th align="end">متأخر</Th><Th align="end">متوسط التجاوز</Th><Th align="end">لديها الآن</Th></tr>
                  </THead>
                  <TBody>
                    {k.byStep.map((s) => (
                      <Tr key={s.step} flag={s.late > 0 && s.late / Math.max(1, s.count) > 0.3 ? "r" : undefined}>
                        <Td>{report.steps[s.step] ?? s.step}</Td>
                        <Td align="end"><Num>{s.count}</Num></Td>
                        <Td><Bar value={s.avgDays} max={stepMaxDays} label={<Num>{s.avgDays.toFixed(1)}</Num>} /></Td>
                        <Td align="end">{s.late ? <span className="font-semibold text-cr6"><Num>{s.late}</Num></span> : <Num>0</Num>}</Td>
                        <Td align="end"><Num>{s.late ? `${s.avgOver.toFixed(1)} يوم` : "—"}</Num></Td>
                        <Td align="end"><Num>{s.openNow}</Num></Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            </Card>
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader title="أعمار المستخلصات المفتوحة" sub="أيام عمل منذ التقديم" />
                <div className="flex flex-col gap-2.5 px-[18px] py-4">
                  {k.aging.map((a, i) => (
                    <div key={a.key} className="grid grid-cols-[130px_1fr] items-center gap-2 text-[13px]">
                      <span>{a.label}</span>
                      <Bar value={a.count} max={agingMax} tone={i >= 2 && a.count ? "late" : undefined} />
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <CardHeader title="أكثر أسباب الإعادة للاستيفاء" />
                <div className="flex flex-col gap-2.5 px-[18px] py-4">
                  {k.topReasons.length === 0 && <div className="text-[13px] text-tx3">لا توجد إعادات.</div>}
                  {k.topReasons.map((r) => (
                    <div key={r.name} className="grid grid-cols-[minmax(0,1fr)_minmax(140px,1fr)] items-center gap-2 text-[13px]">
                      <span className="truncate" title={r.name}>{r.name}</span>
                      <Bar value={r.count} max={reasonsMax} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          <Card className="mb-4">
            <CardHeader title="حسب المقاول" />
            <TableWrap>
              <Table className="text-[13px]">
                <THead>
                  <tr><Th>المقاول</Th><Th align="end">المستخلصات</Th><Th align="end">مفتوح</Th><Th>الأعمال المعتمدة</Th><Th align="end">المسدد</Th></tr>
                </THead>
                <TBody>
                  {report.byCompany.map((c) => (
                    <Tr key={c.company}>
                      <Td>{c.company}</Td>
                      <Td align="end"><Num>{c.count}</Num></Td>
                      <Td align="end"><Num>{c.open}</Num></Td>
                      <Td><Bar value={c.gross} max={companyMax} label={<Money>{formatMoney(c.gross, { decimals: 0 })}</Money>} /></Td>
                      <Td align="end"><Money>{formatMoney(c.paid, { decimals: 0 })}</Money></Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </Card>

          <Card>
            <CardHeader
              title="المستخلصات"
              sub={<>{rows.length > TABLE_ROWS ? <>أول <Num>{TABLE_ROWS}</Num> من <Num>{rows.length}</Num> — القائمة الكاملة في ملف Excel</> : <Num>{rows.length}</Num>}</>}
            />
            <TableWrap>
              <Table className="text-[13px]">
                <THead>
                  <tr>
                    <Th>المستخلص</Th><Th>المقاول</Th><Th>القطاع / السنترال</Th><Th>الفئة</Th><Th>الحالة</Th><Th>لدى</Th>
                    <Th align="end">مدة الدورة</Th><Th align="end">الإعادات</Th><Th align="end">القيمة المعتمدة</Th>
                  </tr>
                </THead>
                <TBody>
                  {rows.slice(0, TABLE_ROWS).map((r) => (
                    <Tr key={r.id}>
                      <Td>
                        <Link href={`/invoices/${r.id}`} className="font-bold no-underline hover:underline"><Num>{r.invoiceNo}</Num></Link>
                        <div className="text-xs text-tx3"><Num>{r.contractNo}</Num> · <Num>{r.aoNo}</Num></div>
                      </Td>
                      <Td>{r.company}</Td>
                      <Td>{r.sector}<div className="text-xs text-tx3">{r.central}</div></Td>
                      <Td><CategoryBadge code={r.categoryFinal ? r.category : null} suggested={r.category} /></Td>
                      <Td><Badge>{r.statusLabel}</Badge></Td>
                      <Td>{r.holder}</Td>
                      <Td align="end"><Num>{r.metrics.cycle ?? "—"}</Num></Td>
                      <Td align="end"><Num>{r.metrics.returns}</Num></Td>
                      <Td align="end"><Money>{formatMoney(r.gross)}</Money></Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </Card>
        </>
      )}
    </>
  );
}
