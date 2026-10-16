"use client";

import { Banknote, Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Field, Input, Money, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/format";
import { ALLOWED_ACCEPT_CLIENT } from "../attachments.types";
import { releaseRetentionAction } from "../finance.actions";
import { useAttachments } from "./use-attachments";

type Props = {
  deductionId: string;
  invoiceId: string;
  name: string;
  amount: number;
  docOk: boolean;
  docLabel: string;
  docTypes: { id: string; name: string }[];
  today: string;
};

/** صرف مبلغ محتجز على نفس المستخلص: مستند الصرف لازم يكون مرفق (أو يترفع هنا) */
export function ReleaseRetentionButton(p: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [docOk, setDocOk] = useState(p.docOk);
  const [docType, setDocType] = useState(p.docTypes[0]?.id ?? "");
  const [f, setF] = useState({ method: "شيك", ref: "", date: p.today, note: "" });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const att = useAttachments(p.invoiceId, () => {
    setDocOk(true);
    router.refresh();
  });
  const submit = () =>
    start(async () => {
      const res = await releaseRetentionAction(p.deductionId, f);
      if (!res.ok) return setError(res.message);
      toast.show(res.message ?? "", "ok");
      setOpen(false);
    });
  return (
    <>
      <Button size="sm" variant="pr" onClick={() => setOpen(true)}><Banknote /> صرف</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`صرف ${p.name}`}
        footer={<><Button variant="pr" disabled={pending || !docOk} onClick={submit}><Banknote /> تأكيد الصرف</Button><Button onClick={() => setOpen(false)}>إلغاء</Button></>}
      >
        <div className="flex items-center justify-between rounded-base border border-bd1 bg-hover px-4 py-3 font-bold">
          <span>المبلغ المحتجز</span>
          <Money>{formatMoney(p.amount)} جنيه</Money>
        </div>
        {docOk ? (
          <Alert tone="g">مستند «{p.docLabel}» مرفق على المستخلص.</Alert>
        ) : (
          <Alert tone="a" title={`يلزم إرفاق مستند «${p.docLabel}» قبل الصرف`}>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <Select aria-label="نوع المستند" className="w-auto" value={docType} onChange={(e) => setDocType(e.target.value)}>
                {p.docTypes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
              <label className="inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-base border border-bd2 bg-card px-3 text-[13px] font-semibold text-tx">
                <Paperclip className="size-4" aria-hidden /> {att.busy ? "جارٍ الرفع…" : "إرفاق المستند"}
                <input type="file" accept={ALLOWED_ACCEPT_CLIENT} className="hidden" disabled={att.busy} onChange={(e) => att.upload(e.target.files, docType || null)} />
              </label>
            </div>
          </Alert>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="طريقة الصرف" htmlFor="rel-method" required>
            <Select id="rel-method" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option>شيك</option><option>تحويل بنكي</option></Select>
          </Field>
          <Field label="رقم الشيك / التحويل" htmlFor="rel-ref" required>
            <Input id="rel-ref" dir="ltr" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} />
          </Field>
          <Field label="تاريخ الصرف" htmlFor="rel-date" required>
            <Input id="rel-date" type="date" dir="ltr" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
        </div>
        <Field label="ملاحظة (اختياري)" htmlFor="rel-note"><Textarea id="rel-note" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <div className="text-xs text-tx3">يصل إلى المقاول إشعار وبريد إلكتروني بالصرف.</div>
        {error && <Alert tone="r">{error}</Alert>}
      </Modal>
    </>
  );
}
