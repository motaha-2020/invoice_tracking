"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { renewCommitmentAction } from "../commitment.actions";

/** تسجيل خطاب تعزيز الارتباط المالي لأمر التكليف */
export function CommitmentRenewalButton({ aoId, today }: { aoId: string; today: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ newTotal: "", date: today, reference: "", note: "" });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const res = await renewCommitmentAction(aoId, { ...f, newTotal: Number(f.newTotal.replace(/,/g, "")) });
      if (!res.ok) return setError(res.message);
      toast.show(res.message ?? "", "ok");
      setOpen(false);
    });
  return (
    <>
      <Button size="sm" onClick={() => { setError(undefined); setOpen(true); }}><Plus /> تعزيز الارتباط المالي</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="تسجيل تعزيز الارتباط المالي" footer={<><Button variant="pr" disabled={pending} onClick={submit}>حفظ</Button><Button onClick={() => setOpen(false)}>إلغاء</Button></>}>
        <Alert tone="i">يُسجَّل الخطاب في ملاحق أمر التكليف، ويُفك قفل السداد إذا أصبح المفوتر في حدود الارتباط الجديد.</Alert>
        <Field label="قيمة الارتباط المالي بعد التعزيز (جنيه)" htmlFor="cr-total" required>
          <Input id="cr-total" dir="ltr" inputMode="decimal" value={f.newTotal} onChange={(e) => setF({ ...f, newTotal: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="رقم خطاب التعزيز" htmlFor="cr-ref" required><Input id="cr-ref" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
          <Field label="تاريخ الخطاب" htmlFor="cr-date" required><Input id="cr-date" type="date" dir="ltr" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        </div>
        <Field label="ملاحظة" htmlFor="cr-note"><Textarea id="cr-note" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        {error && <Alert tone="r">{error}</Alert>}
      </Modal>
    </>
  );
}
