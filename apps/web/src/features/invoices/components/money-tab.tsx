import type { ReactNode } from "react";
import { Badge, Card, CardBody, CardHeader, Money, Num } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import type { InvoiceCalc } from "../invoice-calc";
import type { InvoiceDetail } from "../invoice.repo";

function Row({ label, value, tone }: { label: ReactNode; value: ReactNode; tone?: "neg" | "tot" }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-1.5 text-[13px]", tone === "neg" && "text-cr7", tone === "tot" && "mt-1 border-t border-bd2 pt-2.5 text-[15px] font-bold")}>
      <span>{label}</span>
      <Money>{value}</Money>
    </div>
  );
}

/** تاب الماليات: الإجمالي ← المحتجز ← المستحق ← الضريبة ← الاستقطاعات ← الصافي (المعادلة في @it/domain/totals) */
export function MoneyTab({ calc, inv }: { calc: InvoiceCalc; inv: InvoiceDetail }) {
  const t = calc.totals;
  const diff = t.gross - calc.summary.submitted;
  const used = calc.aoValue > 0 ? (calc.cumGross / calc.aoValue) * 100 : 0;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="احتساب صافي المستحق" />
        <CardBody>
          <Row label={<b>إجمالي قيمة الأعمال المعتمدة</b>} value={formatMoney(t.gross)} />
          {Object.entries(t.byWorkType).map(([k, v]) => <Row key={k} label={<span className="text-xs text-tx3">{k}</span>} value={formatMoney(v)} />)}
          {t.held.map((h) => <Row key={h.type} tone="neg" label={<>{h.name} (<Num>{`${h.pct}%`}</Num>)</>} value={`− ${formatMoney(h.amount)}`} />)}
          <Row label={<>المستحق صرفه الآن (<Num>{`${t.payNowPct}%`}</Num>)</>} value={formatMoney(t.payableNow)} />
          <Row label={<>ضريبة القيمة المضافة (<Num>{`${t.vatPct}%`}</Num>)</>} value={`+ ${formatMoney(t.vat)}`} />
          {t.deductions.map((d, i) => <Row key={i} tone="neg" label={<>{d.name}{d.pct != null && <> (<Num>{`${d.pct}%`}</Num>)</>}</>} value={`− ${formatMoney(d.amount)}`} />)}
          <Row tone="tot" label="صافي المستحق" value={`${formatMoney(t.net)} ${inv.contract.currency === "EGP" ? "جنيه" : inv.contract.currency}`} />
          <div className="mt-2 rounded-base bg-hover px-3 py-2 text-xs text-tx2">فقط {t.words}</div>
          {!inv.deductions.length && <div className="mt-2 text-xs text-tx3">الاستقطاعات قيم افتراضية من شروط التعاقد، وتؤكدها الإدارة المالية عند السداد.</div>}
        </CardBody>
      </Card>
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="المقدم مقابل المعتمد" />
          <CardBody>
            <Row label="المقدم من المقاول" value={formatMoney(calc.summary.submitted)} />
            <Row label="المعتمد" value={formatMoney(t.gross)} />
            <Row label="الفرق" tone={diff < 0 ? "neg" : undefined} value={`${diff < 0 ? "− " : ""}${formatMoney(Math.abs(diff))}`} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="التراكمي على أمر التكليف" />
          <CardBody>
            <div className="flex flex-wrap justify-between gap-2 text-[13px]">
              <span>التراكمي <Money>{formatMoney(calc.cumGross)}</Money></span>
              <span>قيمة أمر التكليف <Money>{formatMoney(calc.aoValue)}</Money></span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={Math.round(used)} aria-valuemin={0} aria-valuemax={100} aria-label="نسبة التراكمي من قيمة أمر التكليف">
              <div className={cn("h-full rounded-full", used > 100 ? "bg-cr6" : used > 90 ? "bg-wa6" : "bg-ok6")} style={{ width: `${Math.min(100, used)}%` }} />
            </div>
            <div className="mt-1.5 text-xs text-tx3">
              {used > 100 ? <Badge tone="r">تجاوز بنسبة <Num>{`${(used - 100).toFixed(1)}%`}</Num></Badge> : <>المستخدم <Num>{`${used.toFixed(1)}%`}</Num> من قيمة أمر التكليف</>}
            </div>
            {calc.commitment?.warning && <div className="mt-2 text-xs font-semibold text-cr7">{calc.commitment.warning}</div>}
          </CardBody>
        </Card>
        {inv.status === "paid" && (
          <Card>
            <CardHeader title="بيانات السداد" />
            <CardBody className="grid grid-cols-2 gap-3 text-[13px]">
              <div><div className="text-xs text-tx3">الطريقة</div><b>{inv.paymentMethod ?? "—"}</b></div>
              <div><div className="text-xs text-tx3">الرقم المرجعي</div><b className="num">{inv.paymentRef ?? "—"}</b></div>
              <div><div className="text-xs text-tx3">التاريخ</div><b className="num">{formatDate(inv.paidAt)}</b></div>
              <div><div className="text-xs text-tx3">المبلغ</div><Money>{formatMoney(inv.paymentAmount)}</Money></div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
