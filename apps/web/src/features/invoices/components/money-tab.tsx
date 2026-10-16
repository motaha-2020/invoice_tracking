import type { ReactNode } from "react";
import { Badge, Card, CardBody, CardHeader, Money, Num } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { HELD_LABELS, type HeldType } from "@it/domain";
import type { InvoiceCalc } from "../invoice-calc";
import type { InvoiceDetail } from "../invoice.repo";
import type { InvoiceView } from "../invoice-view.service";
import { DeductionsEditor } from "./deductions-editor";
import { ReleaseRetentionButton } from "./release-retention";

function Row({ label, value, tone }: { label: ReactNode; value: ReactNode; tone?: "neg" | "tot" }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-1.5 text-[13px]", tone === "neg" && "text-cr7", tone === "tot" && "mt-1 border-t border-bd2 pt-2.5 text-[15px] font-bold")}>
      <span>{label}</span>
      <Money>{value}</Money>
    </div>
  );
}

/** تاب الماليات: الإجمالي ← المحتجز ← المستحق ← الضريبة ← الاستقطاعات ← الصافي (المعادلة في @it/domain/totals) */
type Props = { calc: InvoiceCalc; inv: InvoiceDetail; editor: InvoiceView["deductionEditor"]; retention: InvoiceView["retention"]; today: string };

export function MoneyTab({ calc, inv, editor, retention, today }: Props) {
  const t = calc.totals;
  const diff = t.gross - calc.summary.submitted;
  const used = calc.aoValue > 0 ? (calc.cumGross / calc.aoValue) * 100 : 0;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="احتساب صافي المستحق" actions={editor ? <DeductionsEditor invoiceId={inv.id} gross={t.gross} initial={editor} /> : undefined} />
        <CardBody>
          <Row label={<b>إجمالي قيمة الأعمال المعتمدة</b>} value={formatMoney(t.gross)} />
          {Object.entries(t.byWorkType).map(([k, v]) => <Row key={k} label={<span className="text-xs text-tx3">{k}</span>} value={formatMoney(v)} />)}
          {t.held.map((h) => <Row key={h.type} tone="neg" label={<>{h.name} (<Num>{`${h.pct}%`}</Num>)</>} value={`− ${formatMoney(h.amount)}`} />)}
          <Row label={<>المستحق صرفه الآن (<Num>{`${t.payNowPct}%`}</Num>)</>} value={formatMoney(t.payableNow)} />
          <Row label={<>ضريبة القيمة المضافة (<Num>{`${t.vatPct}%`}</Num>)</>} value={`+ ${formatMoney(t.vat)}`} />
          {t.deductions.map((d, i) => {
            const why = inv.deductionsSet ? inv.deductions.filter((x) => !x.releasable)[i]?.note : null;
            return <Row key={i} tone="neg" label={<>{d.name}{d.pct != null && <> (<Num>{`${d.pct}%`}</Num>)</>}{why && <span className="block text-xs text-tx3">{why}</span>}</>} value={`− ${formatMoney(d.amount)}`} />;
          })}
          <Row tone="tot" label="صافي المستحق" value={`${formatMoney(t.net)} ${inv.contract.currency === "EGP" ? "جنيه" : inv.contract.currency}`} />
          <div className="mt-2 rounded-base bg-hover px-3 py-2 text-xs text-tx2">فقط {t.words}</div>
          {!inv.deductionsSet && <div className="mt-2 text-xs text-tx3">الاستقطاعات قيم افتراضية من شروط التعاقد، وتؤكدها الإدارة المالية قبل السداد.</div>}
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
        {inv.status === "paid" && inv.deductions.some((d) => d.releasable) && (
          <Card>
            <CardHeader title="المبالغ المحتجزة" sub="تُصرف على المستخلص نفسه بعد إرفاق مستندها" />
            <CardBody className="flex flex-col gap-3">
              {inv.deductions.filter((d) => d.releasable).map((d) => {
                const type = d.type as HeldType;
                return (
                  <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-base border border-bd1 px-3 py-2 text-[13px]">
                    <div className="min-w-0 flex-1">
                      <b>{d.name}</b>
                      {d.releasedAt ? (
                        <div className="text-xs text-tx3">
                          صُرف بتاريخ <Num>{formatDate(d.releasedAt)}</Num> — {d.releaseMethod} رقم <Num>{d.releaseRef}</Num>
                          {d.releasedBy && <> · {d.releasedBy.name}</>}
                        </div>
                      ) : (
                        <div className="text-xs text-tx3">بانتظار {HELD_LABELS[type]}</div>
                      )}
                    </div>
                    <Money>{formatMoney(d.amount)}</Money>
                    {d.releasedAt ? <Badge tone="g">تم الصرف</Badge> : <Badge tone="a">محتجز</Badge>}
                    {!d.releasedAt && retention?.canRelease && (
                      <ReleaseRetentionButton
                        deductionId={d.id}
                        invoiceId={inv.id}
                        name={d.name}
                        amount={Number(d.amount ?? 0)}
                        docOk={retention.present[type]}
                        docLabel={HELD_LABELS[type]}
                        docTypes={retention.docs[type]}
                        today={today}
                      />
                    )}
                  </div>
                );
              })}
            </CardBody>
          </Card>
        )}
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
