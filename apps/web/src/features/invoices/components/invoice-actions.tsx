"use client";

import { Banknote, CheckCheck, Pause, Play, Send, ShieldAlert, Tags, Undo2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Alert, Badge, Button, CategoryBadge, Field, Input, Num, Select, SlaChip, Textarea } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import type { SlaTone } from "@/components/ui/sla-chip";
import { useAct } from "./use-act";

export type ActionsProps = {
  invoiceId: string;
  access: {
    turn: boolean;
    override: boolean;
    canApprove: boolean;
    canPay: boolean;
    canReturn: boolean;
    canCategory: boolean;
    canResubmit: boolean;
    companyResubmit: boolean;
    canHold: boolean;
    canRelease: boolean;
  };
  status: string;
  holder: string;
  sla: { tone: SlaTone; label: string; elapsed: number | null; sla: number | null };
  next: { name: string; sla: number | null } | null;
  category: string | null;
  suggestion: { category: string; reasons: string[] };
  categories: { code: string; name: string; steps: number; sla: number }[];
  returnTargets: { key: string; label: string }[];
  returnReasons: { id: string; name: string }[];
  /** المرحلة اللي المستخلص هيرجع لها بعد الاستيفاء */
  resubmitTo: string | null;
  lastReturnNote: string | null;
  net: string;
  netWords: string;
  /** سبب قفل السداد (تجاوز الارتباط المالي) */
  payBlocked: string | null;
};

type Dialog = null | "approve" | "category" | "return" | "resubmit" | "hold" | "release" | "pay";

const HOLD_REASONS = [
  "بانتظار اعتماد ملحق زيادة أمر التكليف",
  "بانتظار اعتماد أمر التكليف",
  "بانتظار تعزيز الارتباط المالي",
  "بانتظار تسعير بند مستجد",
  "بانتظار مستندات من جهة خارجية",
  "أخرى",
];

/** شريط الإجراءات أسفل صفحة المستخلص + مودالات الحركات */
export function InvoiceActions(p: ActionsProps) {
  const [dlg, setDlg] = useState<Dialog>(null);
  const { run, pending, error, setError } = useAct(p.invoiceId);
  const a = p.access;
  const open = (d: Dialog) => {
    setError(undefined);
    setDlg(d);
  };
  const close = () => setDlg(null);
  const needCat = a.canCategory && !p.category;

  const buttons: ReactNode[] = [];
  if (a.canCategory)
    buttons.push(<Button key="cat" variant={needCat ? "pr" : "default"} onClick={() => open("category")}><Tags /> {needCat ? "تحديد فئة التجاوز" : "تغيير الفئة"}</Button>);
  if (a.canApprove)
    buttons.push(
      <Button key="ok" variant={needCat ? "default" : "pr"} disabled={needCat} title={needCat ? "يرجى تحديد فئة التجاوز أولاً" : undefined} onClick={() => open("approve")}>
        <CheckCheck /> اعتماد وإحالة{p.next ? ` إلى ${p.next.name}` : ""}
      </Button>,
    );
  if (a.canPay) buttons.push(<Button key="pay" variant="pr" onClick={() => open("pay")}><Banknote /> تسجيل السداد</Button>);
  if (a.canReturn) buttons.push(<Button key="ret" variant="dg" onClick={() => open("return")}><Undo2 /> إعادة للاستيفاء</Button>);
  if (a.canResubmit) buttons.push(<Button key="rs" variant="pr" onClick={() => open("resubmit")}><Send /> إعادة التقديم</Button>);
  if (a.canHold) buttons.push(<Button key="hold" variant="wa" onClick={() => open("hold")}><Pause /> إيقاف مؤقت</Button>);
  if (a.canRelease) buttons.push(<Button key="rel" variant="pr" onClick={() => open("release")}><Play /> استئناف</Button>);
  if (!buttons.length) return null;

  const overrideNote = a.override && (
    <Alert tone="p" title="تجاوز إداري">أنت تتخذ الإجراء <b>بالنيابة عن {p.holder}</b>، ويُسجَّل ذلك في سجل الإجراءات باسمك.</Alert>
  );
  const err = error && <Alert tone="r">{error}</Alert>;
  const footer = (main: ReactNode) => (
    <>
      {main}
      <Button onClick={close}>إلغاء</Button>
    </>
  );

  return (
    <>
      <div data-print="hide" role="region" aria-label="إجراءات المستخلص" className="sticky bottom-0 z-10 -mx-1 mt-5 flex flex-wrap items-center gap-2 rounded-md border border-bd1 bg-card px-4 py-3 shadow-raised">
        <div className="me-auto flex flex-wrap items-center gap-2 text-[13px] text-tx2">
          {a.override ? (
            <Badge tone="p"><ShieldAlert className="size-3.5" aria-hidden /> تجاوز إداري</Badge>
          ) : (
            p.status !== "on_hold" && <SlaChip tone={p.sla.tone} label={p.sla.label} elapsed={p.sla.elapsed} sla={p.sla.sla} />
          )}
          <span>لدى: <b className="text-tx">{p.holder}</b></span>
        </div>
        {buttons}
      </div>

      <Modal open={dlg === "approve"} onClose={close} title="اعتماد وإحالة" footer={footer(<Button variant="pr" disabled={pending} onClick={() => run({ type: "approve", note: val("act-note") }, close)}><CheckCheck /> اعتماد وإحالة</Button>)}>
        {overrideNote}
        {p.next && (
          <Alert tone="i">
            سيُحال المستخلص إلى <b>{p.next.name}</b>
            {p.next.sla != null && <> (المدة المستهدفة <Num>{p.next.sla}</Num> يوم عمل)</>}، ويصل إشعار وبريد إلكتروني إلى المسؤولين عنها.
          </Alert>
        )}
        <Field label="ملاحظة (اختياري)" htmlFor="act-note"><Textarea id="act-note" rows={3} placeholder="أي ملاحظة للمرحلة التالية…" /></Field>
        {err}
      </Modal>

      <CategoryDialog open={dlg === "category"} onClose={close} p={p} pending={pending} run={run} overrideNote={overrideNote} err={err} />

      <ReturnDialog open={dlg === "return"} onClose={close} p={p} pending={pending} run={run} overrideNote={overrideNote} err={err} setError={setError} />

      <Modal open={dlg === "resubmit"} onClose={close} title="إعادة التقديم بعد الاستيفاء" footer={footer(<Button variant="pr" disabled={pending} onClick={() => run({ type: "resubmit", note: val("rs-note") }, close)}><Send /> إعادة التقديم</Button>)}>
        {overrideNote}
        <Alert tone="i">
          يعود المستخلص مباشرةً إلى <b>{p.resubmitTo ?? "المرحلة التي أعادته"}</b> وليس إلى بداية المسار.
          {p.lastReturnNote && <div className="mt-1 whitespace-pre-line text-xs">المطلوب: {p.lastReturnNote}</div>}
        </Alert>
        {a.companyResubmit && (
          <Alert tone="a">لإرفاق مستندات جديدة أو تعديل البنود قبل إعادة التقديم استخدم «تحديث المستخلص» في أعلى الصفحة — تُحفظ التعديلات في نسخة جديدة.</Alert>
        )}
        <Field label="ما تم استيفاؤه" htmlFor="rs-note" required><Textarea id="rs-note" rows={3} placeholder="مثال: أُرفقت شهادة الاستلام وعُدِّل الحصر" /></Field>
        {err}
      </Modal>

      <HoldDialog open={dlg === "hold"} onClose={close} holder={p.holder} pending={pending} run={run} err={err} setError={setError} />

      <Modal open={dlg === "release"} onClose={close} title="استئناف المراجعة" footer={footer(<Button variant="pr" disabled={pending} onClick={() => run({ type: "release", note: val("rel-note") }, close)}><Play /> استئناف</Button>)}>
        <Alert tone="i">يعود المستخلص إلى المرحلة التي أُوقف فيها، ويبدأ احتساب المدة المستهدفة من جديد.</Alert>
        <Field label="ملاحظة (اختياري)" htmlFor="rel-note"><Textarea id="rel-note" rows={2} /></Field>
        {err}
      </Modal>

      <PayDialog open={dlg === "pay"} onClose={close} p={p} pending={pending} run={run} overrideNote={overrideNote} err={err} setError={setError} />
    </>
  );
}

/** قيمة خانة في المودال المفتوح (الخانات uncontrolled عشان المودال يفضل خفيف) */
function val(id: string): string {
  const el = typeof document !== "undefined" ? (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null) : null;
  return el?.value ?? "";
}

type Run = ReturnType<typeof useAct>["run"];
type DialogProps = { open: boolean; onClose: () => void; pending: boolean; run: Run; err: ReactNode };

function CategoryDialog({ open, onClose, p, pending, run, overrideNote, err }: DialogProps & { p: ActionsProps; overrideNote: ReactNode }) {
  const [cat, setCat] = useState(p.category ?? p.suggestion.category);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={p.category ? "تغيير فئة التجاوز" : "تحديد فئة التجاوز"}
      footer={<><Button variant="pr" disabled={pending} onClick={() => run({ type: "setCategory", category: cat, note: val("cat-note") }, onClose)}><Tags /> حفظ الفئة</Button><Button onClick={onClose}>إلغاء</Button></>}
    >
      {overrideNote}
      <Alert tone="p" title={<>الفئة المقترحة من المنظومة: {p.suggestion.category}</>}>
        <ul className="m-0 mt-1 list-disc ps-4 text-xs">
          {p.suggestion.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </Alert>
      <div role="radiogroup" aria-label="الفئة" className="flex flex-col gap-2">
        {p.categories.map((c) => (
          <label key={c.code} className="flex cursor-pointer items-center gap-3 rounded-base border border-bd2 px-3 py-2 has-checked:border-brand has-checked:bg-brand-soft">
            <input type="radio" name="cat" value={c.code} checked={cat === c.code} onChange={() => setCat(c.code)} />
            <CategoryBadge code={c.code} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-tx3"><Num>{c.steps}</Num> مرحلة · إجمالي المدة المستهدفة <Num>{c.sla}</Num> يوم عمل</div>
            </div>
            {c.code === p.suggestion.category && <Badge tone="p">مقترحة</Badge>}
          </label>
        ))}
      </div>
      <Field label="ملاحظة" htmlFor="cat-note" hint="إلزامية عند اختيار فئة تختلف عن الفئة المقترحة">
        <Textarea id="cat-note" rows={2} />
      </Field>
      {err}
    </Modal>
  );
}

function ReturnDialog({ open, onClose, p, pending, run, overrideNote, err, setError }: DialogProps & { p: ActionsProps; overrideNote: ReactNode; setError: (m?: string) => void }) {
  const [reasons, setReasons] = useState<string[]>([]);
  const submit = () => {
    if (!reasons.length) return setError("يرجى اختيار سبب واحد على الأقل للإعادة للاستيفاء");
    if (!val("ret-note").trim()) return setError("يرجى إدخال ملاحظة توضح المطلوب استيفاؤه");
    run({ type: "return", target: val("ret-target") || "company", reasonIds: reasons, note: val("ret-note") }, () => {
      setReasons([]);
      onClose();
    });
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title="إعادة المستخلص للاستيفاء" footer={<><Button variant="dg" disabled={pending} onClick={submit}><Undo2 /> إعادة للاستيفاء</Button><Button onClick={onClose}>إلغاء</Button></>}>
      {overrideNote}
      <Field label="الجهة المُعاد إليها" htmlFor="ret-target" required>
        <Select id="ret-target" defaultValue="company">
          {p.returnTargets.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </Select>
      </Field>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 text-[13px] font-medium text-tx2">أسباب الإعادة <span className="text-cr6">*</span></legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {p.returnReasons.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-start gap-2 text-[13px]">
              <input
                type="checkbox"
                className="mt-1"
                checked={reasons.includes(r.id)}
                onChange={(e) => setReasons((xs) => (e.target.checked ? [...xs, r.id] : xs.filter((x) => x !== r.id)))}
              />
              {r.name}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="المطلوب استيفاؤه تحديداً" htmlFor="ret-note" required>
        <Textarea id="ret-note" rows={4} placeholder="يرجى بيان المطلوب بالتفصيل — سطر لكل ملاحظة" />
      </Field>
      <Alert tone="i">بعد الاستيفاء يعود المستخلص إليك مباشرةً وليس إلى بداية المسار.</Alert>
      {err}
    </Modal>
  );
}

function HoldDialog({ open, onClose, holder, pending, run, err, setError }: DialogProps & { holder: string; setError: (m?: string) => void }) {
  const submit = () => {
    const pre = val("hold-reason") || HOLD_REASONS[0]!;
    const txt = val("hold-note").trim();
    if (pre === "أخرى" && !txt) return setError("يرجى إدخال سبب الإيقاف المؤقت");
    run({ type: "hold", reason: pre === "أخرى" ? txt : `${pre}${txt ? ` — ${txt}` : ""}` }, onClose);
  };
  return (
    <Modal open={open} onClose={onClose} title="إيقاف المستخلص مؤقتاً" footer={<><Button variant="wa" disabled={pending} onClick={submit}><Pause /> إيقاف مؤقت</Button><Button onClick={onClose}>إلغاء</Button></>}>
      <Alert tone="a">يتوقف احتساب المدة المستهدفة، ويظل المستخلص لدى {holder} حتى الاستئناف.</Alert>
      <Field label="السبب" htmlFor="hold-reason" required>
        <Select id="hold-reason">{HOLD_REASONS.map((r) => <option key={r}>{r}</option>)}</Select>
      </Field>
      <Field label="تفاصيل" htmlFor="hold-note" hint="إلزامية عند اختيار «أخرى»"><Textarea id="hold-note" rows={2} /></Field>
      {err}
    </Modal>
  );
}

function PayDialog({ open, onClose, p, pending, run, overrideNote, err, setError }: DialogProps & { p: ActionsProps; overrideNote: ReactNode; setError: (m?: string) => void }) {
  const submit = () => {
    const ref = val("pay-ref").trim();
    if (!ref) return setError("يرجى إدخال رقم الشيك أو التحويل البنكي");
    run({ type: "pay", method: val("pay-method") || "شيك", ref }, onClose);
  };
  return (
    <Modal open={open} onClose={onClose} title="تسجيل سداد المستخلص" footer={<><Button variant="pr" disabled={pending || !!p.payBlocked} onClick={submit}><Banknote /> تأكيد السداد</Button><Button onClick={onClose}>إلغاء</Button></>}>
      {overrideNote}
      {p.payBlocked && <Alert tone="r" title="السداد مقفل">{p.payBlocked}</Alert>}
      <div className="rounded-base border border-bd1 bg-hover px-4 py-3">
        <div className="flex items-center justify-between font-bold"><span>صافي المستحق</span><Num>{p.net}</Num></div>
        <div className="mt-1 text-xs text-tx2">فقط {p.netWords}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="طريقة السداد" htmlFor="pay-method" required>
          <Select id="pay-method"><option>شيك</option><option>تحويل بنكي</option></Select>
        </Field>
        <Field label="رقم الشيك / التحويل" htmlFor="pay-ref" required>
          <Input id="pay-ref" dir="ltr" inputMode="numeric" />
        </Field>
      </div>
      <div className="text-xs text-tx3">يصل إلى المقاول إشعار وبريد إلكتروني بإتمام السداد.</div>
      {err}
    </Modal>
  );
}
