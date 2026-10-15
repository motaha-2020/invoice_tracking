"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/errors";
import { addReasonAction, deleteReasonAction, moveReasonAction, renameReasonAction, toggleReasonAction } from "../workflow.actions";

type Reason = { id: string; name: string; active: boolean; used: number };

/** أسباب الإرجاع: الاسم بيتحفظ لما تسيب الخانة، والمستخدم في سجل الحركة بيتوقف بس (مش بيتمسح) */
export function ReturnReasons({ reasons }: { reasons: Reason[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState("");

  const run = (fn: () => Promise<ActionState>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      toast.show(res.message ?? "", res.ok ? "ok" : "err");
      if (res.ok) after?.();
    });

  return (
    <Card>
      <CardHeader title="أسباب الإرجاع" sub="اللي بيختار منها المراجع لما يرجّع مستخلص" />
      {reasons.length === 0 ? (
        <EmptyState title="مفيش أسباب لسه" />
      ) : (
        <TableWrap>
          <Table className="text-sm">
            <THead>
              <Tr><Th>الترتيب</Th><Th>السبب</Th><Th align="end">استُخدم</Th><Th>الحالة</Th><Th /></Tr>
            </THead>
            <TBody>
              {reasons.map((r, i) => (
                <Tr key={r.id} className={r.active ? undefined : "opacity-60"}>
                  <Td className="whitespace-nowrap">
                    <Button size="sm" variant="gh" icon aria-label="لفوق" disabled={pending || i === 0} onClick={() => run(() => moveReasonAction(r.id, -1))}><ArrowUp /></Button>
                    <Button size="sm" variant="gh" icon aria-label="لتحت" disabled={pending || i === reasons.length - 1} onClick={() => run(() => moveReasonAction(r.id, 1))}><ArrowDown /></Button>
                  </Td>
                  <Td className="min-w-[260px]">
                    <Input
                      defaultValue={r.name}
                      aria-label="اسم السبب"
                      maxLength={200}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== r.name) run(() => renameReasonAction(r.id, v));
                      }}
                    />
                  </Td>
                  <Td align="end"><span className="num">{r.used}</span> <span className="text-xs text-tx3">مرة</span></Td>
                  <Td>
                    <label className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={r.active} disabled={pending} onChange={(e) => run(() => toggleReasonAction(r.id, e.target.checked))} />
                      {r.active ? <Badge tone="g">شغال</Badge> : <Badge tone="n">متوقف</Badge>}
                    </label>
                  </Td>
                  <Td align="end">
                    <Button
                      size="sm"
                      variant="gh"
                      icon
                      aria-label="مسح السبب"
                      title={r.used ? "مستخدم — وقّفه بدل المسح" : "مسح"}
                      disabled={pending || r.used > 0}
                      onClick={() => run(() => deleteReasonAction(r.id))}
                    >
                      <Trash2 />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
      <CardBody className="flex items-center gap-2 border-t border-bd1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="سبب جديد… مثلاً: شهادة الضمان منتهية"
          aria-label="سبب إرجاع جديد"
          maxLength={200}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) run(() => addReasonAction(draft), () => setDraft(""));
          }}
        />
        <Button variant="pr" disabled={pending || !draft.trim()} onClick={() => run(() => addReasonAction(draft), () => setDraft(""))}>
          <Plus aria-hidden /> إضافة
        </Button>
      </CardBody>
    </Card>
  );
}
