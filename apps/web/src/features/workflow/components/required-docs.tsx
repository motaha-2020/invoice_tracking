"use client";

import { Pencil, Plus, Save } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { Alert, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { saveDocTypeAction, setRequiredDocAction } from "../workflow.actions";

type Item = { id: string; code: string; name: string };
type Stage = "submit" | "finance";
type Req = { projectTypeId: string; docTypeId: string; stage: Stage };
type Props = { docTypes: Item[]; projectTypes: Item[]; required: Req[] };

const STAGES: { key: Stage; label: string }[] = [
  { key: "submit", label: "التقديم" },
  { key: "finance", label: "السداد" },
];
const k = (r: Req) => `${r.projectTypeId}|${r.docTypeId}|${r.stage}`;

/** المستندات الإلزامية: لكل نوع مشروع × مستند — مطلوب عند التقديم و/أو قبل الصرف */
export function RequiredDocs({ docTypes, projectTypes, required }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [set, apply] = useOptimistic(new Set(required.map(k)), (s: Set<string>, c: { key: string; on: boolean }) => {
    const n = new Set(s);
    if (c.on) n.add(c.key);
    else n.delete(c.key);
    return n;
  });
  const [form, setForm] = useState<{ id?: string; code: string; name: string }>({ code: "", name: "" });
  const [formError, setFormError] = useState<string>();

  const toggle = (r: Req, on: boolean) =>
    start(async () => {
      apply({ key: k(r), on });
      const res = await setRequiredDocAction({ ...r, on });
      if (!res.ok) toast.show(res.message ?? "", "err");
    });

  const saveDoc = () =>
    start(async () => {
      const res = await saveDocTypeAction(form);
      if (!res.ok) return setFormError(res.message);
      setFormError(undefined);
      setForm({ code: "", name: "" });
      toast.show(res.message ?? "", "ok");
    });

  const count = (t: Item, stage: Stage) => docTypes.filter((d) => set.has(k({ projectTypeId: t.id, docTypeId: d.id, stage }))).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="المستندات الإلزامية لكل نوع مشروع" sub="لا يمكن تقديم المستخلص (أو سداده) إلا بعد إرفاق المستندات المحددة" />
        {docTypes.length === 0 || projectTypes.length === 0 ? (
          <EmptyState title="لا توجد مستندات أو أنواع مشروعات بعد" />
        ) : (
          <TableWrap>
            <Table className="text-sm">
              <THead>
                <Tr>
                  <Th rowSpan={2}>المستند</Th>
                  {projectTypes.map((t) => <Th key={t.id} colSpan={2} align="center">{t.name}</Th>)}
                  <Th rowSpan={2} />
                </Tr>
                <Tr>
                  {projectTypes.flatMap((t) => STAGES.map((s) => <Th key={`${t.id}-${s.key}`} align="center" className="text-[11px]">{s.label}</Th>))}
                </Tr>
              </THead>
              <TBody>
                {docTypes.map((d) => (
                  <Tr key={d.id}>
                    <Td>{d.name}<div dir="ltr" className="text-end text-[11px] text-tx3">{d.code}</div></Td>
                    {projectTypes.flatMap((t) =>
                      STAGES.map((s) => {
                        const r = { projectTypeId: t.id, docTypeId: d.id, stage: s.key };
                        return (
                          <Td key={`${t.id}-${s.key}`} align="center">
                            <input
                              type="checkbox"
                              className="size-4 accent-[var(--brand)]"
                              checked={set.has(k(r))}
                              aria-label={`${d.name} — ${t.name} — ${s.label}`}
                              onChange={(e) => toggle(r, e.target.checked)}
                            />
                          </Td>
                        );
                      }),
                    )}
                    <Td align="end">
                      <Button size="sm" variant="gh" icon aria-label="تعديل المستند" onClick={() => setForm({ id: d.id, code: d.code, name: d.name })}><Pencil /></Button>
                    </Td>
                  </Tr>
                ))}
                <Tr className="font-semibold">
                  <Td>عدد المستندات الإلزامية</Td>
                  {projectTypes.flatMap((t) => STAGES.map((s) => <Td key={`${t.id}-${s.key}`} align="center"><span className="num">{count(t, s.key)}</span></Td>))}
                  <Td />
                </Tr>
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader title={form.id ? "تعديل مستند" : "نوع مستند جديد"} />
        <CardBody className="space-y-3">
          {formError && <Alert tone="r">{formError}</Alert>}
          <div className="grid grid-cols-[1fr_2fr_auto] items-end gap-2 max-sm:grid-cols-1">
            <Field label="الكود" htmlFor="dt-code" required hint="بالحروف الإنجليزية فقط — مثال: test_report">
              <Input id="dt-code" dir="ltr" value={form.code} maxLength={60} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </Field>
            <Field label="الاسم" htmlFor="dt-name" required>
              <Input id="dt-name" value={form.name} maxLength={200} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <div className="flex gap-2 pb-[18px] max-sm:pb-0">
              <Button variant="pr" disabled={pending} onClick={saveDoc}>
                {form.id ? <Save aria-hidden /> : <Plus aria-hidden />} {form.id ? "حفظ" : "إضافة"}
              </Button>
              {form.id && <Button variant="gh" onClick={() => setForm({ code: "", name: "" })}>إلغاء</Button>}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
