"use client";

import { Pencil, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { updateContractAction } from "../contract-edit.actions";
import type { ContractEditField, ContractEditInput } from "../contract-edit.schema";

type Form = Record<ContractEditField, string>;
const toForm = (v: ContractEditInput): Form =>
  Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x == null ? "" : String(x)])) as Form;

/** حقل رقمي (نسبة / قيمة) */
function NumField({ f, k, label, set, suffix, hint }: { f: Form; k: ContractEditField; label: string; set: (k: ContractEditField, v: string) => void; suffix?: string; hint?: string }) {
  return (
    <Field label={suffix ? `${label} (${suffix})` : label} htmlFor={`ce-${k}`} hint={hint}>
      <Input id={`ce-${k}`} dir="ltr" inputMode="decimal" value={f[k]} onChange={(e) => set(k, e.target.value)} />
    </Field>
  );
}

/** زرار «تعديل بيانات العقد» — للشئون الفنية ومدير النظام (contracts.edit) */
export function ContractEditButton({ contractId, values }: { contractId: string; values: ContractEditInput }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Form>(() => toForm(values));
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const set = (k: ContractEditField, v: string) => setF((x) => ({ ...x, [k]: v }));
  const paySum = ["payMonthlyPct", "payAsbuiltPct", "payHandoverPct"].reduce((a, k) => a + (Number(f[k as ContractEditField]) || 0), 0);

  const submit = () =>
    start(async () => {
      const res = await updateContractAction(contractId, f);
      if (!res.ok) return setError(res.message);
      toast.show(res.message ?? "", "ok");
      setOpen(false);
    });

  const props = { f, set };
  return (
    <>
      <Button size="sm" onClick={() => { setF(toForm(values)); setError(undefined); setOpen(true); }}><Pencil aria-hidden /> تعديل بيانات العقد</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="تعديل بيانات العقد"
        footer={<><Button variant="pr" disabled={pending} onClick={submit}><Save aria-hidden /> {pending ? "جارٍ الحفظ…" : "حفظ التعديلات"}</Button><Button onClick={() => setOpen(false)}>إلغاء</Button></>}
      >
        <Alert tone="i">تُطبَّق النسب الجديدة على حساب المستخلصات الجارية، أما المستخلصات المسددة فتبقى بقيمها وقت السداد. ويُسجَّل كل تعديل في سجل التدقيق باسمك.</Alert>
        <Field label="موضوع العقد" htmlFor="ce-title" required>
          <Textarea id="ce-title" rows={2} value={f.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumField {...props} k="contractValue" label="قيمة العقد" />
          <Field label="العملة" htmlFor="ce-currency"><Input id="ce-currency" dir="ltr" maxLength={3} value={f.currency} onChange={(e) => set("currency", e.target.value)} /></Field>
          <Field label="تاريخ برقية القبول" htmlFor="ce-awardDate"><Input id="ce-awardDate" type="date" dir="ltr" value={f.awardDate} onChange={(e) => set("awardDate", e.target.value)} /></Field>
          <Field label="تاريخ البدء" htmlFor="ce-startDate"><Input id="ce-startDate" type="date" dir="ltr" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
          <Field label="تاريخ الانتهاء" htmlFor="ce-endDate"><Input id="ce-endDate" type="date" dir="ltr" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field>
          <NumField {...props} k="warrantyMonths" label="الضمان الفني" suffix="شهر" />
        </div>

        <h4 className="m-0 mt-1 text-sm font-semibold">شروط السداد <span className={paySum === 100 ? "text-xs font-normal text-tx3" : "text-xs font-normal text-cr6"}>(المجموع {paySum}% — يجب أن يساوي 100%)</span></h4>
        <div className="grid gap-3 sm:grid-cols-4">
          <NumField {...props} k="payMonthlyPct" label="الصرف الشهري" suffix="%" />
          <NumField {...props} k="payAsbuiltPct" label="محجوز As-Built" suffix="%" />
          <NumField {...props} k="payHandoverPct" label="محجوز الاستلام الابتدائي" suffix="%" />
          <NumField {...props} k="planningPayPct" label="سداد أعمال التخطيط" suffix="%" />
        </div>

        <h4 className="m-0 mt-1 text-sm font-semibold">الضرائب والضمانات والغرامات</h4>
        <div className="grid gap-3 sm:grid-cols-4">
          <NumField {...props} k="vatPct" label="ضريبة القيمة المضافة" suffix="%" />
          <NumField {...props} k="taxPct" label="خصم من المنبع" suffix="%" hint="فارغ = غير محدد" />
          <NumField {...props} k="finalGuaranteePct" label="خطاب الضمان النهائي" suffix="%" />
          <NumField {...props} k="retentionPct" label="تأمين الأعمال" suffix="%" />
          <NumField {...props} k="advancePct" label="الدفعة المقدمة" suffix="%" />
          <NumField {...props} k="delayFinePctWeek" label="غرامة التأخير أسبوعياً" suffix="%" />
          <NumField {...props} k="delayFineCapPct" label="الحد الأقصى للغرامة" suffix="%" />
        </div>

        <h4 className="m-0 mt-1 text-sm font-semibold">رسوم الدمغة (على أمر التكليف)</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumField {...props} k="stampEngineeringPct" label="هندسية" suffix="%" />
          <NumField {...props} k="stampAppliedArtsPct" label="فنون تطبيقية" suffix="%" />
          <NumField {...props} k="stampConstructionPct" label="تشييد" suffix="%" />
        </div>
        <Field label="علاوة خارج النطاق" htmlFor="ce-outOfScopeUplift" hint="مثال: 5% / 10% / 15% سيناء">
          <Input id="ce-outOfScopeUplift" value={f.outOfScopeUplift} onChange={(e) => set("outOfScopeUplift", e.target.value)} />
        </Field>
        {error && <Alert tone="r">{error}</Alert>}
      </Modal>
    </>
  );
}
