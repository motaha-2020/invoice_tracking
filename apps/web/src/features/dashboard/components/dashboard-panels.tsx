import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardHeader, EmptyState, Num } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatCount, formatMoney } from "@/lib/format";
import type { MoneyTotals } from "@/features/insights/insights.rules";
import { filterQuery, type ReportFilter } from "@/features/reports/reports.filters";
import { UNLINKED, gaugePct, levelOf, type Level, type StageProgress, type Tile } from "../dashboard.rules";

/** القيم الكبيرة بالمليون (والقيمة الكاملة في التلميح) */
export function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })} مليون`;
  if (a >= 1e3) return `${(v / 1e3).toLocaleString("en-US", { maximumFractionDigits: 1 })} ألف`;
  return formatMoney(v, { decimals: 0 });
}
const pctText = (v: number | null) => (v == null ? "—" : `${v.toFixed(v >= 10 ? 0 : 1)}%`);

const LEVEL: Record<Level, string> = {
  cr: "border-cr3 bg-cr1 text-cr7",
  wa: "border-wa3 bg-wa1 text-wa7",
  in: "border-in3 bg-in1 text-in7",
  ok: "border-ok3 bg-ok1 text-ok7",
  none: "border-bd2 bg-sunken text-tx3",
};

/** بلاطات نسبة المفوتر — الضغط بيصفّي اللوحة على الإدارة العامة / السنترال */
export function OrgTiles({ tiles, level, f }: { tiles: Tile[]; level: "generalDept" | "central"; f: ReportFilter }) {
  const what = level === "central" ? "السنترال" : "الإدارة العامة";
  return (
    <Card>
      <CardHeader title={`نسبة المفوتر من قيمة أوامر التكليف حسب ${what}`} sub="اضغط على أي مربع للتصفية" />
      {tiles.length === 0 ? (
        <EmptyState title="لا توجد بيانات" />
      ) : (
        <div className="px-[18px] py-3.5 max-sm:px-3">
          <div className="grid max-h-[300px] grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 overflow-y-auto">
            {tiles.map((t) => {
              const lv = t.id === UNLINKED ? "none" : levelOf(t.pct);
              const body = (
                <>
                  <div className="truncate text-[13px] font-semibold" title={t.name}>{t.name}</div>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <Num className="text-xl font-bold">{pctText(t.pct)}</Num>
                    <span className="truncate text-[11px] opacity-80">{compact(t.billed)} · {formatCount(t.invoices)} مستخلص</span>
                  </div>
                </>
              );
              const cls = cn("block rounded-md border px-3 py-2 no-underline", LEVEL[lv]);
              return t.id === UNLINKED ? (
                <div key={t.id} className={cls} title="أوامر تكليف غير مرتبطة بمشروع — يمكن ربطها من زر «ربط بالهيكل»">{body}</div>
              ) : (
                <Link key={t.id} href={`/dashboard?${filterQuery({ ...f, [level]: t.id })}`} className={cn(cls, "transition-shadow hover:shadow-raised")} scroll={false}>
                  {body}
                </Link>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tx2">
            {([["cr", "أقل من 25%"], ["wa", "25% – 50%"], ["in", "50% – 75%"], ["ok", "75% فأكثر"], ["none", "غير مرتبط / بدون قيمة"]] as const).map(([lv, label]) => (
              <span key={lv} className="inline-flex items-center gap-1.5">
                <span aria-hidden className={cn("size-3 rounded-sm border", LEVEL[lv])} /> {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/** تقدم المستخلصات بالمراحل: اجتاز / لم يصل بعد */
export function StageBars({ rows, names, t }: { rows: StageProgress[]; names: Record<string, string>; t: MoneyTotals }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-bd1 px-[18px] py-3 max-sm:px-3">
        <MiniStat label="% المفوتر" value={pctText(t.aoValue > 0 ? (t.billed / t.aoValue) * 100 : null)} />
        <h3 className="m-0 text-center text-[15px] font-bold">تقدم المستخلصات بالمراحل</h3>
        <MiniStat label="% المسدد" value={pctText(t.billed > 0 ? (t.paid / t.billed) * 100 : null)} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="لا توجد مستخلصات مقدمة" />
      ) : (
        <ul className="m-0 list-none space-y-1.5 px-[18px] py-3 max-sm:px-3">
          {rows.map((r) => {
            const total = r.passed + r.pending;
            const w = total ? (r.passed / total) * 100 : 0;
            return (
              <li key={r.step} className="grid grid-cols-[120px_1fr] items-center gap-2 max-sm:grid-cols-[90px_1fr]">
                <span className="truncate text-xs text-tx2" title={names[r.step]}>{names[r.step] ?? r.step}</span>
                <div className="flex h-5 overflow-hidden rounded-base bg-p100 text-[11px] font-semibold" title={`اجتاز ${r.passed} · لم يصل بعد ${r.pending}`}>
                  {r.passed > 0 && <div className="flex items-center bg-brand px-1.5 text-white" style={{ width: `${Math.max(w, 6)}%` }}><Num>{r.passed}</Num></div>}
                  {r.pending > 0 && <div className="ms-auto flex items-center px-1.5 text-brand-tx"><Num>{r.pending}</Num></div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex gap-4 px-[18px] pb-3 text-xs text-tx2 max-sm:px-3">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-sm bg-brand" /> اجتاز المرحلة</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-sm bg-p100" /> لم يصل إليها بعد</span>
      </div>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[88px] rounded-md border border-p200 bg-p50 px-2.5 py-1 text-center">
      <div className="text-[11px] font-semibold text-brand-tx">{label}</div>
      <Num className="text-lg font-bold">{value}</Num>
    </div>
  );
}

/** بطاقات القيم */
export function ValueCards({ t }: { t: MoneyTotals }) {
  const cards: [string, number, ReactNode][] = [
    ["قيمة العقود", t.contractValue, `${formatCount(t.contracts)} عقد`],
    ["قيمة أوامر التكليف", t.aoValue, `${formatCount(t.aos)} أمر تكليف`],
    ["المفوتر", t.billed, `${formatCount(t.invoices)} مستخلص`],
    ["المتبقي من أوامر التكليف", t.aoRemaining, "قيمة أوامر التكليف − المفوتر"],
  ];
  return (
    <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2">
      {cards.map(([label, v, sub]) => (
        <div key={label} className="rounded-md border border-p200 bg-p50 px-3 py-2.5 text-center" title={formatMoney(v, { decimals: 0 })}>
          <div className="text-xs font-semibold text-brand-tx">{label}</div>
          <Num className={cn("mt-1 block text-xl font-bold", v < 0 && "text-cr6")}>{compact(v)}</Num>
          <div className="text-[11px] text-tx3">{sub}</div>
        </div>
      ))}
    </div>
  );
}

/** مؤشر نصف دائري — pathLength=100 عشان النسبة تبقى طول القوس مباشرة */
export function Gauge({ title, value, max, display, maxDisplay, tone = "brand" }: { title: string; value: number; max: number; display: string; maxDisplay: string; tone?: "brand" | "ok" | "wa" | "cr" }) {
  const p = gaugePct(value, max);
  const stroke = { brand: "stroke-brand", ok: "stroke-ok6", wa: "stroke-wa6", cr: "stroke-cr6" }[tone];
  return (
    <div className="rounded-md border border-bd1 bg-card px-3 py-2.5 text-center shadow-card">
      <div className="text-[13px] font-semibold">{title}</div>
      <svg viewBox="0 0 100 58" className="mx-auto mt-1 w-full max-w-[180px]" role="img" aria-label={`${title}: ${display} من ${maxDisplay}`}>
        <path d="M10 52 A40 40 0 0 1 90 52" fill="none" className="stroke-p100" strokeWidth="11" pathLength={100} />
        {p > 0 && <path d="M10 52 A40 40 0 0 1 90 52" fill="none" className={stroke} strokeWidth="11" pathLength={100} strokeDasharray={`${p} 100`} />}
        <text x="50" y="49" textAnchor="middle" className="fill-tx text-[11px] font-bold">{display}</text>
      </svg>
      <div dir="ltr" className="flex justify-between text-[11px] text-tx3">
        <Num>0</Num>
        <Num>{maxDisplay}</Num>
      </div>
    </div>
  );
}
