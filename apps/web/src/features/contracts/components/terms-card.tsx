import type { ReactNode } from "react";
import { Card, CardHeader, Num } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import type { ContractView } from "../contracts.service";

type Numeric = { toString(): string } | null | undefined;
const pct = (v: Numeric) => (v == null ? "—" : `${Number(v.toString())}%`);

function Term({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-full" : undefined}>
      <dt className="text-xs text-tx3">{label}</dt>
      <dd className="m-0 mt-0.5 font-semibold">{children}</dd>
    </div>
  );
}

/** كارت رأس العقد: كل الشروط من برقية القبول */
export function TermsCard({ view }: { view: ContractView }) {
  const c = view.contract;
  return (
    <Card>
      <CardHeader title="شروط العقد" sub={c.company.name} />
      <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-x-5 gap-y-3.5 px-[18px] py-4 max-sm:px-3">
        <Term label="موضوع العقد" wide>{c.title}</Term>
        <Term label="قيمة العقد"><Num>{formatMoney(c.contractValue, { decimals: 0 })}</Num> <span className="text-xs text-tx3">{c.currency}</span></Term>
        <Term label="برقية القبول"><Num>{formatDate(c.awardDate)}</Num></Term>
        <Term label="البدء ← الانتهاء"><Num>{formatDate(c.startDate)}</Num> ← <Num>{formatDate(c.endDate)}</Num></Term>
        <Term label="شروط الصرف"><span dir="ltr">{view.terms}</span></Term>
        <Term label="صرف أعمال التخطيط"><Num>{pct(c.planningPayPct)}</Num></Term>
        <Term label="ضريبة القيمة المضافة"><Num>{pct(c.vatPct)}</Num></Term>
        <Term label="خصم من المنبع"><Num>{pct(c.taxPct)}</Num></Term>
        <Term label="خطاب الضمان النهائي"><Num>{pct(c.finalGuaranteePct)}</Num> <span className="text-xs text-tx3">من أمر التكليف</span></Term>
        <Term label="غرامة التأخير">
          {c.delayFinePctWeek == null ? "—" : <><Num>{pct(c.delayFinePctWeek)}</Num> أسبوعياً</>}
          {c.delayFineCapPct != null && <span className="text-xs text-tx3"> (حد أقصى <Num>{pct(c.delayFineCapPct)}</Num>)</span>}
        </Term>
        <Term label="الضمان الفني">{c.warrantyMonths == null ? "—" : <><Num>{c.warrantyMonths}</Num> شهر</>}</Term>
        <Term label="الدمغات (على أمر التكليف)">
          <span className="text-[13px]">
            هندسية <Num>{pct(c.stampEngineeringPct)}</Num> · فنون تطبيقية <Num>{pct(c.stampAppliedArtsPct)}</Num> · تشييد <Num>{pct(c.stampConstructionPct)}</Num>
          </span>
        </Term>
        {(Number(c.retentionPct) > 0 || Number(c.advancePct) > 0) && (
          <Term label="تأمين أعمال / دفعة مقدمة"><Num>{pct(c.retentionPct)}</Num> / <Num>{pct(c.advancePct)}</Num></Term>
        )}
        {c.outOfScopeUplift && <Term label="علاوة خارج النطاق" wide>{c.outOfScopeUplift}</Term>}
      </dl>
    </Card>
  );
}
