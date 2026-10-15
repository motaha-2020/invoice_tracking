"use client";

import { Plus, Trash2, UserRoundCog } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Select, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { addDelegationAction, deleteDelegationAction } from "../users.actions";
import type { DelegationRow, UserPick } from "../users.types";

type Props = { rows: DelegationRow[]; users: UserPick[]; today: string };

const empty = { fromUserId: "", toUserId: "", startsOn: "", endsOn: "", note: "" };

/** التفويض: المستخدم ده في أجازة، والبديل بيستلم بداله في الفترة دي */
export function DelegationsPanel({ rows, users, today }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [message, setMessage] = useState<string>();
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const add = () =>
    start(async () => {
      const res = await addDelegationAction(f);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setMessage(res.message);
        return;
      }
      setErrors({});
      setMessage(undefined);
      setF(empty);
      toast.show(res.message ?? "", "ok");
    });

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteDelegationAction(id);
      toast.show(res.message ?? "", res.ok ? "ok" : "err");
    });

  const state = (d: DelegationRow) =>
    d.endsOn < today ? <Badge tone="n">خلص</Badge> : d.startsOn > today ? <Badge tone="b">جاي</Badge> : <Badge tone="a">شغال دلوقتي</Badge>;

  return (
    <div className="grid grid-cols-[2fr_1fr] items-start gap-4 max-xl:grid-cols-1">
      <Card>
        <CardHeader title="التفويضات" sub="مين بيستلم بدل مين وإمتى" />
        {rows.length === 0 ? (
          <EmptyState icon={UserRoundCog} title="مفيش تفويضات">
            <div className="text-[13px]">لما حد ياخد أجازة سجّل البديل هنا.</div>
          </EmptyState>
        ) : (
          <TableWrap>
            <Table className="text-sm">
              <THead>
                <Tr><Th>المستخدم</Th><Th>البديل</Th><Th>الفترة</Th><Th>الحالة</Th><Th>ملاحظة</Th><Th /></Tr>
              </THead>
              <TBody>
                {rows.map((d) => (
                  <Tr key={d.id}>
                    <Td><b>{d.fromUser.name}</b></Td>
                    <Td>{d.toUser.name}</Td>
                    <Td className="whitespace-nowrap text-xs">
                      <span className="num">{formatDate(d.startsOn)}</span> ← <span className="num">{formatDate(d.endsOn)}</span>
                    </Td>
                    <Td>{state(d)}</Td>
                    <Td className="max-w-[220px] truncate text-xs text-tx2" title={d.note ?? undefined}>{d.note ?? "—"}</Td>
                    <Td align="end">
                      <Button size="sm" variant="gh" icon aria-label="شيل التفويض" disabled={pending} onClick={() => remove(d.id)}><Trash2 /></Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader title="تفويض جديد" />
        <CardBody className="flex flex-col gap-3">
          {message && <Alert tone="r">{message}</Alert>}
          <Field label="المستخدم (اللي في أجازة)" htmlFor="d-from" required error={errors.fromUserId}>
            <Select id="d-from" value={f.fromUserId} onChange={set("fromUserId")}>
              <option value="">— اختار —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="البديل" htmlFor="d-to" required error={errors.toUserId}>
            <Select id="d-to" value={f.toUserId} onChange={set("toUserId")}>
              <option value="">— اختار —</option>
              {users.filter((u) => u.id !== f.fromUserId).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="من" htmlFor="d-start" required error={errors.startsOn}>
              <Input id="d-start" type="date" value={f.startsOn} onChange={set("startsOn")} />
            </Field>
            <Field label="لحد" htmlFor="d-end" required error={errors.endsOn}>
              <Input id="d-end" type="date" value={f.endsOn} min={f.startsOn || undefined} onChange={set("endsOn")} />
            </Field>
          </div>
          <Field label="ملاحظة" htmlFor="d-note">
            <Input id="d-note" value={f.note} onChange={set("note")} maxLength={300} placeholder="مثلاً: أجازة سنوية" />
          </Field>
          <Button variant="pr" disabled={pending} onClick={add}>
            <Plus aria-hidden /> إضافة التفويض
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
