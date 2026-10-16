import { Banknote, ClipboardList, FileSignature, Hourglass, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardHeader, EmptyState, Kpi, Money, Num, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { Bar } from "@/features/reports/components/report-charts";
import { cn } from "@/lib/cn";
import { formatCount, formatMoney } from "@/lib/format";
import { pct, type Group, type Insights, type MoneyTotals, type StageSlice } from "../insights.rules";

const m = (v: number) => formatMoney(v, { decimals: 0 });
const p = (v: number) => `${v.toFixed(v >= 10 || v === 0 ? 0 : 1)}%`;

/** بطاقات القيم: العقود ← أوامر التكليف ← المفوتر ← المسدد ← الجاري ← المتبقي، وشريط توزيع قيمة أوامر التكليف */
export function MoneyOverview({ t, showContracts = true }: { t: MoneyTotals; showContracts?: boolean }) {
  return (
    <>
      <div className="mb-3 grid grid-cols-3 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1">
        {showContracts && <Kpi icon={FileSignature} label="قيمة العقود" value={m(t.contractValue)} sub={`${formatCount(t.contracts)} عقد`} />}
        <Kpi icon={ClipboardList} label="قيمة أوامر التكليف" value={m(t.aoValue)} sub={<>{formatCount(t.aos)} أمر تكليف · الارتباط المالي <Num>{m(t.commitment)}</Num></>} />
        <Kpi icon={Receipt} label="إجمالي المفوتر" value={m(t.billed)} sub={<>{formatCount(t.invoices)} مستخلص · <Num>{p(pct(t.billed, t.aoValue))}</Num> من قيمة أوامر التكليف</>} />
        <Kpi icon={Banknote} label="تم سداده" value={m(t.paid)} tone="g" sub={<>{formatCount(t.paidInvoices)} مستخلص · <Num>{p(pct(t.paid, t.billed))}</Num> من المفوتر</>} href="/invoices?status=paid" />
        <Kpi icon={Hourglass} label="جارٍ في مسار الاعتماد" value={m(t.pending)} tone={t.pending > 0 ? "a" : undefined} sub={<>{formatCount(t.pendingInvoices)} مستخلص{t.onHold > 0 && <> · منها موقوف <Num>{m(t.onHold)}</Num></>}</>} href="/invoices?status=active" />
        <Kpi icon={Wallet} label="المتبقي من أوامر التكليف" value={m(t.aoRemaining)} tone={t.aoRemaining < 0 ? "r" : undefined} sub={t.draft > 0 ? <>مسودات لدى المقاول <Num>{m(t.draft)}</Num></> : "قيمة أوامر التكليف − المفوتر"} />
      </div>
      <SplitBar t={t} />
    </>
  );
}

/** توزيع قيمة أوامر التكليف: مسدد | جارٍ | متبقٍ */
function SplitBar({ t }: { t: MoneyTotals }) {
  const total = Math.max(t.aoValue, t.billed);
  if (total <= 0) return null;
  const parts = [
    { label: "تم سداده", v: t.paid, cls: "bg-ok6" },
    { label: "جارٍ في مسار الاعتماد", v: t.pending, cls: "bg-wa6" },
    { label: "المتبقي من أوامر التكليف", v: Math.max(0, t.aoValue - t.billed), cls: "bg-sunken" },
  ];
  return (
    <Card className="mb-4 px-[18px] py-3.5">
      <div className="mb-2 text-[13px] font-medium text-tx2">توزيع قيمة أوامر التكليف</div>
      <div className="flex h-3 overflow-hidden rounded-full bg-sunken" role="img" aria-label="توزيع قيمة أوامر التكليف">
        {parts.map((x) => x.v > 0 && <div key={x.label} className={x.cls} style={{ width: `${pct(x.v, total)}%` }} title={`${x.label}: ${m(x.v)}`} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-tx2">
        {parts.map((x) => (
          <span key={x.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2.5 rounded-full border border-bd2", x.cls)} />
            {x.label} <Num className="font-semibold text-tx">{m(x.v)}</Num> (<Num>{p(pct(x.v, total))}</Num>)
          </span>
        ))}
      </div>
    </Card>
  );
}

const STAGE_FIXED: Record<string, string> = { company: "لدى المقاول (مسودات)", returned: "معاد للاستيفاء", hold: "موقوف مؤقتاً", paid: "تم السداد" };

function stageHref(k: string): string {
  if (k === "paid") return "/invoices?status=paid";
  if (k === "hold") return "/invoices?status=on_hold";
  if (k === "returned") return "/invoices?status=returned";
  if (k === "company") return "/invoices?status=draft";
  return `/invoices?status=active&step=${encodeURIComponent(k)}`;
}

/** القيم حسب موقع المستخلص في مسار الاعتماد */
export function StageBreakdown({ stages, names, className }: { stages: StageSlice[]; names: Record<string, { name: string }>; className?: string }) {
  const max = Math.max(0, ...stages.map((s) => s.amount));
  return (
    <Card className={className}>
      <CardHeader title="القيم حسب مرحلة الاعتماد" sub="أين توجد قيمة المستخلصات الآن" />
      {stages.length === 0 ? (
        <EmptyState title="لا توجد مستخلصات" />
      ) : (
        <ul className="m-0 list-none space-y-2.5 px-[18px] py-3.5 max-sm:px-3">
          {stages.map((s) => (
            <li key={s.key} className="grid grid-cols-[minmax(150px,220px)_1fr] items-center gap-3 max-sm:grid-cols-1 max-sm:gap-1">
              <Link href={stageHref(s.key)} className="truncate text-[13px] no-underline hover:underline">
                {STAGE_FIXED[s.key] ?? names[s.key]?.name ?? s.key} <span className="text-xs text-tx3">(<Num>{formatCount(s.count)}</Num>)</span>
              </Link>
              <Bar value={s.amount} max={max} label={<Num>{m(s.amount)}</Num>} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function WorkTypeBreakdown({ rows, className }: { rows: Insights["byWorkType"]; className?: string }) {
  const max = Math.max(0, ...rows.map((r) => r.billed));
  return (
    <Card className={className}>
      <CardHeader title="المفوتر حسب نوع الأعمال" />
      {rows.length === 0 ? (
        <EmptyState title="لا توجد مستخلصات" />
      ) : (
        <ul className="m-0 list-none space-y-2.5 px-[18px] py-3.5 max-sm:px-3">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[minmax(120px,170px)_1fr] items-center gap-3">
              <span className="truncate text-[13px]">{r.label} <span className="text-xs text-tx3">(<Num>{formatCount(r.count)}</Num>)</span></span>
              <Bar value={r.billed} max={max} label={<Num>{m(r.billed)}</Num>} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** جدول تجميعي (شركات / عقود / مشروعات): الاسم لينك لصفحته */
export function GroupTable({ title, sub, rows, href, labelHead, limit }: { title: string; sub?: ReactNode; rows: Group[]; href: (g: Group) => string; labelHead: string; limit?: number }) {
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <Card className="mt-4">
      <CardHeader title={title} sub={sub ?? <Num>{rows.length}</Num>} />
      {rows.length === 0 ? (
        <EmptyState title="لا توجد بيانات" />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th>{labelHead}</Th>
                <Th align="end">أوامر التكليف</Th>
                <Th align="end">قيمة أوامر التكليف</Th>
                <Th>نسبة المفوتر</Th>
                <Th align="end">المفوتر</Th>
                <Th align="end">تم سداده</Th>
                <Th align="end">جارٍ في المسار</Th>
                <Th align="end">المستخلصات</Th>
              </tr>
            </THead>
            <TBody>
              {shown.map((g) => {
                const ratio = pct(g.billed, g.aoValue);
                return (
                  <Tr key={g.id} flag={ratio > 100 ? "r" : undefined}>
                    <Td>
                      <Link href={href(g)} className="font-bold text-brand-tx no-underline hover:underline"><span dir="auto">{g.label}</span></Link>
                      {g.sub && <div className="max-w-[300px] truncate text-xs text-tx3">{g.sub}</div>}
                    </Td>
                    <Td align="end"><Num>{formatCount(g.aos)}</Num></Td>
                    <Td align="end"><Money>{m(g.aoValue)}</Money></Td>
                    <Td><Bar value={Math.min(ratio, 100)} max={100} tone={ratio > 100 ? "late" : undefined} label={<Num>{p(ratio)}</Num>} /></Td>
                    <Td align="end"><Money>{m(g.billed)}</Money></Td>
                    <Td align="end"><Num className="text-ok7">{m(g.paid)}</Num></Td>
                    <Td align="end"><Num className={g.pending > 0 ? "text-wa7" : "text-tx3"}>{m(g.pending)}</Num></Td>
                    <Td align="end"><Num>{formatCount(g.invoices)}</Num></Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
          {limit && rows.length > limit && <div className="px-[18px] py-2 text-xs text-tx3">يُعرض أعلى {limit} من {rows.length} حسب القيمة المفوترة</div>}
        </TableWrap>
      )}
    </Card>
  );
}

type AoRow = {
  id: string;
  aoNo: string;
  name: string;
  value: { toString(): string } | null;
  contract: { id: string; contractNo: string; company: { id: string; name: string } };
  project: { id: string; code: string; name: string } | null;
};

/** أوامر التكليف مع المفوتر عليها — رقم أمر التكليف والعقد والمشروع لينكات */
export function AoMoneyTable({ aos, byAo, showCompany = false, showProject = true }: { aos: AoRow[]; byAo: Map<string, Group>; showCompany?: boolean; showProject?: boolean }) {
  return (
    <Card className="mt-4">
      <CardHeader title="أوامر التكليف" sub={<Num>{aos.length}</Num>} />
      {aos.length === 0 ? (
        <EmptyState icon={ClipboardList} title="لا توجد أوامر تكليف" />
      ) : (
        <TableWrap className="max-h-[560px] overflow-y-auto">
          <Table>
            <THead>
              <tr>
                <Th>أمر التكليف</Th>
                <Th>العقد</Th>
                {showCompany && <Th>المقاول</Th>}
                {showProject && <Th>المشروع</Th>}
                <Th align="end">القيمة</Th>
                <Th>نسبة المفوتر</Th>
                <Th align="end">المفوتر</Th>
                <Th align="end">تم سداده</Th>
                <Th align="end">المستخلصات</Th>
              </tr>
            </THead>
            <TBody>
              {aos.map((a) => {
                const g = byAo.get(a.id);
                const value = a.value == null ? 0 : Number(a.value.toString());
                const ratio = pct(g?.billed ?? 0, value);
                return (
                  <Tr key={a.id} flag={ratio > 100 ? "r" : undefined}>
                    <Td>
                      <Link href={`/contracts/${a.contract.id}/aos/${a.id}`} className="font-bold text-brand-tx no-underline hover:underline"><Num>{a.aoNo}</Num></Link>
                      <div className="max-w-[260px] truncate text-xs text-tx3" title={a.name}>{a.name}</div>
                    </Td>
                    <Td><Link href={`/contracts/${a.contract.id}`} className="no-underline hover:underline"><Num>{a.contract.contractNo}</Num></Link></Td>
                    {showCompany && <Td><Link href={`/companies/${a.contract.company.id}`} className="no-underline hover:underline">{a.contract.company.name}</Link></Td>}
                    {showProject && (
                      <Td className="text-[13px]">
                        {a.project ? <Link href={`/projects/${a.project.id}`} className="no-underline hover:underline">{a.project.name}</Link> : <span className="text-tx3">غير مرتبط بمشروع</span>}
                      </Td>
                    )}
                    <Td align="end"><Money>{m(value)}</Money></Td>
                    <Td><Bar value={Math.min(ratio, 100)} max={100} tone={ratio > 100 ? "late" : undefined} label={<Num>{p(ratio)}</Num>} /></Td>
                    <Td align="end"><Money>{m(g?.billed ?? 0)}</Money></Td>
                    <Td align="end"><Num className="text-ok7">{m(g?.paid ?? 0)}</Num></Td>
                    <Td align="end"><Num>{formatCount(g?.invoices ?? 0)}</Num></Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </Card>
  );
}
