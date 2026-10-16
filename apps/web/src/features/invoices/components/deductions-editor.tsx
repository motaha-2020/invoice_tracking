"use client";

import { Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert, Button, Field, Money, Textarea } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/format";
import { saveDeductionsAction } from "../finance.actions";

type Row = { type: "tax" | "penalty" | "other"; name: string; mode: "pct" | "amount"; value: string; note: string };
type Initial = { type: Row["type"]; name: string; mode: Row["mode"]; value: number; note?: string | null };

const TYPE_LABELS: Record<Row["type"], string> = { tax: "خصم ضريبي", other: "استقطاع آخر", penalty: "غرامة" };
const cell = "h-8 w-full rounded-base border border-bd2 bg-card px-2 text-[13px]";

/** المالية: مراجعة الاستقطاعات قبل السداد — الغرامات يدوي بمبلغ وسبب */
export function DeductionsEditor({ invoiceId, gross, initial }: { invoiceId: string; gross: number; initial: Initial[] }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const reset = () => {
    setRows(initial.map((r) => ({ ...r, value: String(r.value), note: r.note ?? "" })));
    setNote("");
    setError(undefined);
    setOpen(true);
  };
  const set = (i: number, patch: Partial<Row>) => setRows((xs) => xs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const amount = (r: Row) => {
    const v = Number(r.value.replace(/,/g, "")) || 0;
    return r.mode === "pct" ? Math.round(gross * v) / 100 : v;
  };
  const total = rows.reduce((a, r) => a + amount(r), 0);

  const save = () =>
    start(async () => {
      const payload = rows.map((r) => ({ type: r.type, name: r.name, mode: r.mode, value: Number(r.value.replace(/,/g, "")), note: r.note || null }));
      const res = await saveDeductionsAction(invoiceId, { rows: payload, note });
      if (!res.ok) return setError(res.message);
      toast.show(res.message ?? "", "ok");
      setOpen(false);
    });

  return (
    <>
      <Button size="sm" onClick={reset}><SlidersHorizontal /> مراجعة الاستقطاعات</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="مراجعة الاستقطاعات قبل السداد"
        footer={<><Button variant="pr" disabled={pending} onClick={save}>حفظ الاستقطاعات</Button><Button onClick={() => setOpen(false)}>إلغاء</Button></>}
      >
        <div className="text-[13px] text-tx2">النسب تُحسب من إجمالي الأعمال المعتمدة (<Money>{formatMoney(gross)}</Money> جنيه). الغرامة تُدخل كمبلغ مع بيان سببها.</div>
        <div className="flex flex-col gap-2">
          {rows.length === 0 && <div className="text-[13px] text-tx3">لا توجد استقطاعات.</div>}
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[110px_minmax(0,1fr)_100px_110px_110px_32px] items-center gap-2 max-md:grid-cols-2">
              <span className="text-xs font-semibold text-tx2">{TYPE_LABELS[r.type]}</span>
              <input className={cell} aria-label="اسم الاستقطاع" value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
              <select className={cell} aria-label="نوع القيمة" value={r.mode} disabled={r.type === "penalty"} onChange={(e) => set(i, { mode: e.target.value as Row["mode"] })}>
                <option value="pct">نسبة %</option>
                <option value="amount">مبلغ</option>
              </select>
              <input className={`${cell} text-end`} dir="ltr" inputMode="decimal" aria-label="القيمة" value={r.value} onChange={(e) => set(i, { value: e.target.value })} />
              <Money className="text-end">{formatMoney(amount(r))}</Money>
              <Button size="sm" variant="gh" icon aria-label="حذف" onClick={() => setRows((xs) => xs.filter((_, j) => j !== i))}><Trash2 /></Button>
              {r.type !== "tax" && (
                <input className={`${cell} col-span-full`} aria-label="السبب" placeholder={r.type === "penalty" ? "سبب الغرامة (إلزامي) — مثال: تأخير 12 يوماً عن الجدول الزمني" : "ملاحظة (اختياري)"} value={r.note} onChange={(e) => set(i, { note: e.target.value })} />
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setRows((xs) => [...xs, { type: "penalty", name: "غرامة تأخير", mode: "amount", value: "0", note: "" }])}><Plus /> إضافة غرامة</Button>
          <Button size="sm" variant="gh" onClick={() => setRows((xs) => [...xs, { type: "other", name: "استقطاع آخر", mode: "amount", value: "0", note: "" }])}><Plus /> استقطاع آخر</Button>
          {!rows.some((r) => r.type === "tax") && (
            <Button size="sm" variant="gh" onClick={() => setRows((xs) => [...xs, { type: "tax", name: "خصم ضريبي من المنبع", mode: "pct", value: "1", note: "" }])}><Plus /> خصم ضريبي</Button>
          )}
          <span className="ms-auto text-[13px]">إجمالي الاستقطاعات <Money>{formatMoney(total)}</Money></span>
        </div>
        <Field label="ملاحظة (تُسجَّل في سجل الإجراءات)" htmlFor="ded-note"><Textarea id="ded-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {error && <Alert tone="r">{error}</Alert>}
      </Modal>
    </>
  );
}
