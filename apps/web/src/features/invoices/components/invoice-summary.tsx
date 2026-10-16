import type { ReactNode } from "react";
import { Alert, Badge, Money, Num } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import type { InvoiceView } from "../invoice-view.service";

function Kv({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-tx3">{label}</dt>
      <dd className="m-0 mt-0.5 font-semibold">{children}</dd>
    </div>
  );
}

/** بيانات المستخلص: العقد وأمر التكليف والهيكل والفترة والأيام والإجماليات */
export function InvoiceSummary({ v }: { v: InvoiceView }) {
  const { inv, calc, cycle } = v;
  const c = inv.ao.project?.central;
  return (
    <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-x-5 gap-y-3.5">
      <Kv label="العقد"><Num>{inv.contract.contractNo}</Num><span className="block text-xs font-normal text-tx3">{inv.contract.title}</span></Kv>
      <Kv label="أمر التكليف"><Num>{inv.ao.aoNo}</Num><span className="block text-xs font-normal text-tx3">{inv.ao.name}</span></Kv>
      <Kv label="المشروع">{inv.ao.project?.name ?? "—"}<span className="block text-xs font-normal text-tx3">{inv.ao.project?.type.name}</span></Kv>
      <Kv label="السنترال">{c?.name ?? "—"}</Kv>
      <Kv label="الإدارة المختصة">{c?.dept.name ?? "—"}</Kv>
      <Kv label="الإدارة العامة">{c?.dept.generalDept.name ?? "—"}</Kv>
      <Kv label="القطاع">{c?.dept.generalDept.sector.name ?? "—"}</Kv>
      <Kv label="رئاسة القطاعات">{c?.dept.generalDept.sector.presidency.name ?? "—"}</Kv>
      <Kv label="نوع الأعمال">{inv.workType?.name ?? "—"}</Kv>
      <Kv label="الفترة">{inv.period ?? "—"}</Kv>
      <Kv label="تاريخ التقديم">{inv.submittedAt ? <Num>{formatDate(inv.submittedAt)}</Num> : "لم يُقدَّم بعد"}</Kv>
      <Kv label="مدة الدورة">
        {cycle.total == null ? "—" : <><Num>{cycle.total}</Num> يوم عمل</>}
        {cycle.company > 0 && <span className="block text-xs font-normal text-tx3">منها <Num>{cycle.company}</Num> يوم لدى المقاول</span>}
      </Kv>
      <Kv label="رقم النسخة">
        <Num>{v.revision?.n ?? 1}</Num>
        {inv.revisions.length > 1 && <Badge className="ms-1.5">معدّلة</Badge>}
      </Kv>
      <Kv label="إجمالي الأعمال المعتمدة"><Money>{formatMoney(calc.totals.gross)}</Money> <span className="text-xs font-normal">جنيه</span></Kv>
      <Kv label="صافي المستحق"><Money>{formatMoney(calc.totals.net)}</Money> <span className="text-xs font-normal">جنيه</span></Kv>
    </dl>
  );
}

/** تنبيهات أعلى الصفحة: المسار المبدئي، الإعادة للاستيفاء، الارتباط المالي، المستندات، الإيقاف، السداد */
export function InvoiceCallouts({ v }: { v: InvoiceView }) {
  const { inv, calc } = v;
  const out: ReactNode[] = [];
  const short = (k: string | null) => (k ? (v.steps[k]?.short ?? k) : "—");
  if (inv.status === "draft") out.push(<Alert key="d" tone="i">المستخلص مسودة لدى المقاول ولم يُقدَّم بعد، والمسار المعروض مبدئي.</Alert>);
  else if (v.tentative && inv.status !== "paid")
    out.push(<Alert key="t" tone="i">المسار مبدئي على الفئة المقترحة {v.pathCategory} إلى أن يحدد مدير التنفيذ فئة التجاوز.</Alert>);
  if (inv.status === "returned") {
    const e = [...inv.log].reverse().find((x) => x.action === "return");
    out.push(
      <Alert key="r" tone="i" title={<>المستخلص حالياً لدى {v.holder} — أُعيد من {short(inv.returnedFrom)}{e && <> بتاريخ <Num>{formatDate(e.at)}</Num></>}</>}>
        {e && e.reasons.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{e.reasons.map((r) => <Badge key={r.reason.id} tone="b">{r.reason.name}</Badge>)}</div>}
        {e?.note && <div className="mt-1.5 whitespace-pre-line">{e.note}</div>}
        <div className="mt-1 text-xs">بعد الاستيفاء يعود المستخلص إلى {short(inv.returnedFrom)} مباشرةً وليس إلى بداية المسار.</div>
      </Alert>,
    );
  }
  if (inv.status !== "paid" && inv.status !== "draft") {
    if (calc.commitment?.warning) out.push(<Alert key="c" tone={calc.commitment.level === "exceeded" ? "r" : "a"}>{calc.commitment.warning}</Alert>);
    if (v.missingDocs.length) out.push(<Alert key="m" tone="a">مستندات إلزامية غير مرفقة: {v.missingDocs.join("، ")}</Alert>);
  }
  if (inv.status === "on_hold")
    out.push(<Alert key="h" tone="a" title="المستخلص موقوف مؤقتاً">{inv.holdReason ?? "بانتظار أمر التكليف"} — يتوقف احتساب المدة المستهدفة حتى الاستئناف.</Alert>);
  if (inv.status === "paid")
    out.push(
      <Alert key="p" tone="g" title="تم السداد">
        {inv.paymentMethod} رقم <Num>{inv.paymentRef}</Num> بتاريخ <Num>{formatDate(inv.paidAt)}</Num> · صافي <Money>{formatMoney(inv.paymentAmount)}</Money> جنيه
      </Alert>,
    );
  return out.length ? <div className="mt-4 flex flex-col gap-2">{out}</div> : null;
}
