"use client";

import { Pencil, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, buttonClasses, Field, Input, Select, Textarea, type ButtonSize } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { deleteRecordAction, updateRecordAction } from "../records.actions";
import { ENTITY_LABEL, type FieldSpec, type RecordEntity, type RecordValues } from "../records.fields";

type Props = {
  entity: RecordEntity;
  id: string;
  /** اسم السجل في الرسائل — مثل: PO25 أو رقم البند */
  name: string;
  /** نموذج التعديل — من غيره زرار التعديل بيبقى رابط (editHref) أو مش ظاهر */
  form?: { fields: FieldSpec[]; values: RecordValues };
  editHref?: string;
  /** بعد الحذف — الصفحة الحالية بتاعة السجل نفسه مش هتبقى موجودة */
  afterDeleteHref?: string;
  deleteWarning?: string;
  /** أزرار بنص (رأس الصفحة) بدل أيقونات (صفوف الجداول) */
  labeled?: boolean;
  size?: ButtonSize;
};

/** زرارا التعديل والحذف — بيتعرضوا لمدير النظام بس (الصفحة بتقرر بـ canManageRecords والسيرفر بيتحقق تاني) */
export function RecordActions({ entity, id, name, form, editHref, afterDeleteHref, deleteWarning, labeled, size = "sm" }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [mode, setMode] = useState<"edit" | "delete" | null>(null);
  const [values, setValues] = useState<RecordValues>(form?.values ?? {});
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const label = ENTITY_LABEL[entity];

  const open = (m: "edit" | "delete") => {
    setValues(form?.values ?? {});
    setError(undefined);
    setMode(m);
  };

  const save = () =>
    start(async () => {
      const res = await updateRecordAction(entity, id, values);
      if (!res.ok) return setError(res.message);
      toast.show(res.message ?? "تم الحفظ بنجاح", "ok");
      setMode(null);
    });

  const remove = () =>
    start(async () => {
      const res = await deleteRecordAction(entity, id);
      if (!res.ok) return setError(res.message);
      toast.show(res.message ?? "تم الحذف", "ok");
      setMode(null);
      if (afterDeleteHref) router.replace(afterDeleteHref);
    });

  const editLabel = `تعديل ${label} ${name}`;
  const editButton = form ? (
    <Button variant={labeled ? "default" : "gh"} size={size} icon={!labeled} onClick={() => open("edit")} aria-label={editLabel} title="تعديل">
      <Pencil aria-hidden /> {labeled && "تعديل"}
    </Button>
  ) : editHref ? (
    <Link href={editHref} className={buttonClasses({ variant: labeled ? "default" : "gh", size, icon: !labeled })} aria-label={editLabel} title="تعديل">
      <Pencil aria-hidden /> {labeled && "تعديل"}
    </Link>
  ) : null;

  return (
    <span className="inline-flex gap-1">
      {editButton}
      <Button variant={labeled ? "dg" : "gh"} size={size} icon={!labeled} className={cn(!labeled && "text-cr6")} onClick={() => open("delete")} aria-label={`حذف ${label} ${name}`} title="حذف">
        <Trash2 aria-hidden /> {labeled && "حذف"}
      </Button>

      {/* النوافذ بتتعمل وقت الفتح بس — الجداول فيها مئات الصفوف */}
      {form && mode === "edit" && (
        <Modal
          open
          onClose={() => setMode(null)}
          size={form.fields.length > 4 ? "lg" : "md"}
          title={editLabel}
          footer={<><Button variant="pr" disabled={pending} onClick={save}><Save aria-hidden /> {pending ? "جارٍ الحفظ…" : "حفظ التعديلات"}</Button><Button onClick={() => setMode(null)}>إلغاء</Button></>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {form.fields.map((f) => (
              <FieldInput key={f.key} f={f} value={values[f.key] ?? ""} onChange={(v) => setValues((x) => ({ ...x, [f.key]: v }))} />
            ))}
          </div>
          <p className="m-0 text-xs text-tx3">يُسجَّل كل تعديل في سجل التدقيق باسمك مع القيم قبل التعديل وبعده.</p>
          {error && <Alert tone="r">{error}</Alert>}
        </Modal>
      )}

      {mode === "delete" && (
      <Modal
        open
        onClose={() => setMode(null)}
        title={`حذف ${label} ${name}`}
        footer={<><Button variant="dg" disabled={pending} onClick={remove}><Trash2 aria-hidden /> {pending ? "جارٍ الحذف…" : "تأكيد الحذف"}</Button><Button onClick={() => setMode(null)}>إلغاء</Button></>}
      >
        <p className="m-0">هل تريد حذف {label} <b dir="auto">{name}</b> نهائياً؟ لا يمكن التراجع عن هذا الإجراء.</p>
        {deleteWarning && <Alert tone="a">{deleteWarning}</Alert>}
        {error && <Alert tone="r">{error}</Alert>}
      </Modal>
      )}
    </span>
  );
}

function FieldInput({ f, value, onChange }: { f: FieldSpec; value: string; onChange: (v: string) => void }) {
  const id = `rec-${f.key}`;
  const wide = f.wide && "sm:col-span-2";
  if (f.type === "checkbox") {
    return (
      <label htmlFor={id} className={cn("flex items-center gap-2 self-end pb-2 text-sm", wide)}>
        <input id={id} type="checkbox" checked={value === "1"} onChange={(e) => onChange(e.target.checked ? "1" : "")} />
        {f.label}
      </label>
    );
  }
  return (
    <Field label={f.label} htmlFor={id} required={f.required} hint={f.hint} className={wide || undefined}>
      {f.type === "select" ? (
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      ) : f.type === "textarea" ? (
        <Textarea id={id} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input
          id={id}
          type={f.type === "date" ? "date" : "text"}
          inputMode={f.type === "number" ? "decimal" : undefined}
          dir={f.ltr || f.type === "number" || f.type === "date" ? "ltr" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}
