"use client";

import { Pencil } from "lucide-react";
import { useId, useState } from "react";
import { Alert, Button, Field, Input, Num, Textarea } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { formatQty } from "@/lib/format";
import { useAct } from "./use-act";

type Line = { id: string; itemNo: string; description: string; unit: string | null; qty: number; approvedQty: number; plannedQty: number; prevQty: number };

/** تعديل الكمية المعتمدة لبند (مشرف التنفيذ / مدير التنفيذ / الشئون الفنية) */
export function QtyEditButton({ invoiceId, line }: { invoiceId: string; line: Line }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(String(line.approvedQty));
  const [reason, setReason] = useState("");
  const { run, pending, error, setError } = useAct(invoiceId);
  const close = () => {
    setOpen(false);
    setError(undefined);
  };
  const submit = () => {
    const n = Number(qty.replace(/,/g, ""));
    if (qty.trim() === "" || !Number.isFinite(n) || n < 0) return setError("يرجى إدخال كمية صحيحة (صفر أو أكثر)");
    if (!reason.trim()) return setError("يرجى توضيح سبب تعديل الكمية المعتمدة");
    run({ type: "qty", lineId: line.id, qty: n, reason }, close);
  };
  const kv = (label: string, v: string) => (
    <div><div className="text-xs text-tx3">{label}</div><b className="num">{v}</b></div>
  );
  return (
    <>
      <Button size="sm" variant="gh" icon aria-label={`تعديل الكمية المعتمدة للبند ${line.itemNo}`} title="تعديل الكمية المعتمدة" onClick={() => setOpen(true)}>
        <Pencil />
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={<>تعديل الكمية المعتمدة — البند <Num>{line.itemNo}</Num></>}
        footer={
          <>
            <Button variant="pr" disabled={pending} onClick={submit}>حفظ التعديل</Button>
            <Button onClick={close}>إلغاء</Button>
          </>
        }
      >
        <div className="text-[13px] text-tx2">{line.description}</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kv("المقدم من المقاول", formatQty(line.qty))}
          {kv("المعتمد حالياً", formatQty(line.approvedQty))}
          {kv("المخطط في أمر التكليف", formatQty(line.plannedQty))}
          {kv("السابق", formatQty(line.prevQty))}
        </div>
        <Field label={`الكمية المعتمدة الجديدة${line.unit ? ` (${line.unit})` : ""}`} htmlFor={`${uid}-qty`} required>
          <Input id={`${uid}-qty`} inputMode="decimal" dir="ltr" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="سبب التعديل" htmlFor={`${uid}-reason`} required>
          <Textarea id={`${uid}-reason`} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: نتيجة الحصر المشترك أقل من الكمية المقدمة" />
        </Field>
        {error && <Alert tone="r">{error}</Alert>}
      </Modal>
    </>
  );
}
