"use client";

import { Trash2 } from "lucide-react";
import { createContext, use, useCallback, useId, useMemo, useState, useActionState, type ReactNode } from "react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { ActionState } from "@/lib/errors";
import { deleteOrgEntityAction, saveOrgEntityAction } from "../org.actions";
import { KIND_LABELS, type OrgKind } from "../org.kinds";
import { ENTITY_FIELDS, type FieldDef, type OrgOptions, type SelectOption } from "./entity-fields";

/** قيم السجل للفورم (كلها نصوص) — id موجود = تعديل */
export type EntityRecord = Record<string, string>;
export type DeleteTarget = { id: string; code: string; name: string };

type Dialog =
  | { mode: "form"; kind: OrgKind; record: EntityRecord | null; defaults?: EntityRecord; n: number }
  | { mode: "delete"; kind: OrgKind; target: DeleteTarget; n: number };

type Api = {
  canEdit: boolean;
  openForm: (kind: OrgKind, record?: EntityRecord | null, defaults?: EntityRecord) => void;
  openDelete: (kind: OrgKind, target: DeleteTarget) => void;
};

const Ctx = createContext<Api | null>(null);

export function useOrgDialogs(): Api {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("useOrgDialogs لازم يتنادى جوه <OrgDialogsProvider>");
  return ctx;
}

/** بيمسك حالة نوافذ الإضافة/التعديل/المسح لكل شاشة /org */
export function OrgDialogsProvider({ canEdit, options, children }: { canEdit: boolean; options: OrgOptions; children: ReactNode }) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const toast = useToast();
  const close = useCallback(() => setDialog(null), []);
  const done = useCallback(
    (message?: string) => {
      setDialog(null);
      if (message) toast.show(message, "ok");
    },
    [toast],
  );
  const api = useMemo<Api>(
    () => ({
      canEdit,
      openForm: (kind, record = null, defaults) => setDialog((d) => ({ mode: "form", kind, record, defaults, n: (d?.n ?? 0) + 1 })),
      openDelete: (kind, target) => setDialog((d) => ({ mode: "delete", kind, target, n: (d?.n ?? 0) + 1 })),
    }),
    [canEdit],
  );

  const one = dialog ? KIND_LABELS[dialog.kind].one : "";
  const title = !dialog ? "" : dialog.mode === "delete" ? `مسح ${one}` : dialog.record ? `تعديل ${one}` : `إضافة ${one}`;

  return (
    <Ctx value={api}>
      {children}
      {canEdit && (
        <Modal open={dialog !== null} onClose={close} title={title} size={dialog?.kind === "project" || dialog?.kind === "company" ? "lg" : "md"}>
          {dialog?.mode === "form" && (
            <EntityForm key={dialog.n} kind={dialog.kind} record={dialog.record} defaults={dialog.defaults} options={options} onDone={done} onCancel={close} />
          )}
          {dialog?.mode === "delete" && <DeleteForm key={dialog.n} kind={dialog.kind} target={dialog.target} onDone={done} onCancel={close} />}
        </Modal>
      )}
    </Ctx>
  );
}

const initial: ActionState = { ok: false };

type FormProps = {
  kind: OrgKind;
  record: EntityRecord | null;
  defaults?: EntityRecord;
  options: OrgOptions;
  onDone: (message?: string) => void;
  onCancel: () => void;
};

function EntityForm({ kind, record, defaults, options, onDone, onCancel }: FormProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await saveOrgEntityAction(prev, fd);
    if (r.ok) onDone(r.message);
    return r;
  }, initial);
  const uid = useId();
  const fe = state.fieldErrors ?? {};
  const value = (name: string) => state.values?.[name] ?? record?.[name] ?? defaults?.[name] ?? "";
  const fields = ENTITY_FIELDS[kind];

  return (
    <form action={action} noValidate className="flex flex-col gap-3.5">
      {state.message && <Alert tone="r">{state.message}</Alert>}
      <input type="hidden" name="kind" value={kind} />
      {record?.id && <input type="hidden" name="id" value={record.id} />}
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Field
          label="الكود"
          htmlFor={`${uid}-code`}
          required={!record}
          error={fe.code}
          hint={record ? "الكود مش بيتغير بعد الإضافة" : "حروف وأرقام من غير مسافات (زي S-EAST) — مش هيتغير بعد الحفظ"}
          className="col-span-2 max-sm:col-span-1"
        >
          {record ? (
            <Input id={`${uid}-code`} value={record.code ?? ""} readOnly dir="ltr" className="text-start font-mono" />
          ) : (
            <Input
              id={`${uid}-code`}
              name="code"
              dir="ltr"
              autoComplete="off"
              defaultValue={value("code")}
              required
              autoFocus
              aria-invalid={fe.code ? true : undefined}
              className="text-start font-mono uppercase"
            />
          )}
        </Field>
        {fields.map((f) => (
          <FieldInput key={f.name} f={f} id={`${uid}-${f.name}`} value={value(f.name)} error={fe[f.name]} options={f.options ? options[f.options] : []} />
        ))}
      </div>
      <div className="-mx-5 -mb-[18px] mt-1 flex gap-2 border-t border-bd1 px-5 py-3">
        <Button type="submit" variant="pr" disabled={pending}>
          {pending ? "بيتحفظ…" : record ? "حفظ التعديل" : "إضافة"}
        </Button>
        <Button onClick={onCancel} disabled={pending}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}

function FieldInput({ f, id, value, error, options }: { f: FieldDef; id: string; value: string; error?: string[]; options: SelectOption[] }) {
  const common = {
    id,
    name: f.name,
    defaultValue: value,
    required: f.required,
    "aria-invalid": error ? true : undefined,
  } as const;
  let control: ReactNode;
  if (f.type === "select") {
    control = (
      <Select {...common}>
        <option value="">— اختار —</option>
        <OptionList list={options} />
      </Select>
    );
  } else if (f.type === "textarea") {
    control = <Textarea {...common} rows={3} />;
  } else {
    control = <Input {...common} type={f.type} dir={f.ltr || f.type === "date" ? "ltr" : undefined} className={f.ltr ? "text-start" : undefined} />;
  }
  return (
    <Field label={f.label} htmlFor={id} required={f.required} hint={f.hint} error={error} className={cn(f.wide && "col-span-2 max-sm:col-span-1")}>
      {control}
    </Field>
  );
}

/** الاختيارات متجمعة تحت الأب (optgroup) لو فيه */
function OptionList({ list }: { list: SelectOption[] }) {
  if (!list.some((o) => o.group)) return list.map((o) => <option key={o.id} value={o.id}>{o.label}</option>);
  const groups = new Map<string, SelectOption[]>();
  for (const o of list) {
    const g = o.group ?? "—";
    groups.set(g, [...(groups.get(g) ?? []), o]);
  }
  return [...groups].map(([g, opts]) => (
    <optgroup key={g} label={g}>
      {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </optgroup>
  ));
}

function DeleteForm({ kind, target, onDone, onCancel }: { kind: OrgKind; target: DeleteTarget; onDone: (m?: string) => void; onCancel: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await deleteOrgEntityAction(prev, fd);
    if (r.ok) onDone(r.message);
    return r;
  }, initial);
  const { one } = KIND_LABELS[kind];
  return (
    <form action={action} className="flex flex-col gap-3.5">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={target.id} />
      {state.message ? (
        <Alert tone="r" title="مينفعش يتمسح">{state.message}</Alert>
      ) : (
        <p className="m-0">
          متأكد إنك عايز تمسح {one} <b>«{target.name}»</b> <span className="num text-tx3">({target.code})</span>؟ الحركة دي مش بترجع.
        </p>
      )}
      <div className="-mx-5 -mb-[18px] mt-1 flex gap-2 border-t border-bd1 px-5 py-3">
        {!state.message && (
          <Button type="submit" variant="dg" disabled={pending}>
            <Trash2 aria-hidden /> {pending ? "بيتمسح…" : "مسح"}
          </Button>
        )}
        <Button onClick={onCancel} disabled={pending}>
          {state.message ? "تمام" : "إلغاء"}
        </Button>
      </div>
    </form>
  );
}
