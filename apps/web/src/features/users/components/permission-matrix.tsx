"use client";

import type { Role } from "@it/db";
import { useOptimistic, useTransition } from "react";
import { Alert, Card, TBody, TFoot, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { Permission } from "@/features/auth/permission-rules";
import { ROLE_LABELS } from "@/lib/labels";
import { togglePermissionAction } from "../users.actions";
import { PERMISSION_LABELS } from "../users.labels";
import { ALL_ROLES, PERMISSION_KEYS } from "../users.rules";

type Matrix = Record<Permission, Role[]>;
type Change = { perm: Permission; role: Role; on: boolean };

/** صفوف = الصلاحيات، أعمدة = الأدوار. كل خانة بتتحفظ فوراً (لمدير النظام بس). */
export function PermissionMatrix({ matrix, editable }: { matrix: Matrix; editable: boolean }) {
  const toast = useToast();
  const [, start] = useTransition();
  const [view, apply] = useOptimistic(matrix, (m: Matrix, c: Change) => ({
    ...m,
    [c.perm]: c.on ? [...m[c.perm], c.role] : m[c.perm].filter((r) => r !== c.role),
  }));

  const toggle = (c: Change) =>
    start(async () => {
      apply(c);
      const res = await togglePermissionAction(c.perm, c.role, c.on);
      if (!res.ok) toast.show(res.message ?? "حدث خطأ", "err");
      else toast.show(`${c.on ? "تمت إضافة" : "تمت إزالة"} صلاحية "${PERMISSION_LABELS[c.perm]}" ${c.on ? "إلى" : "من"} ${ROLE_LABELS[c.role]}`, "ok");
    });

  return (
    <>
      <Alert tone="i" className="mb-3">
        تتحدد صلاحية الاعتماد في كل مرحلة من مسار الاعتماد (الدور الوظيفي المسؤول عن المرحلة). تعرض هذه الشاشة الصلاحيات الإضافية، ويُطبَّق أي تعديل فوراً على جميع المستخدمين بالدور الوظيفي نفسه.
        {!editable && " (للاطلاع فقط — التعديل لمدير النظام)"}
      </Alert>
      <Card>
        <TableWrap>
          <Table className="text-sm">
            <THead>
              <Tr>
                <Th className="sticky start-0 z-10 min-w-[240px]">الصلاحية</Th>
                {ALL_ROLES.map((r) => <Th key={r} align="center" className="text-[11px]">{ROLE_LABELS[r]}</Th>)}
              </Tr>
            </THead>
            <TBody>
              {PERMISSION_KEYS.map((p) => (
                <Tr key={p}>
                  <Td className="sticky start-0 bg-card">
                    <b>{PERMISSION_LABELS[p]}</b>
                    <div dir="ltr" className="text-end text-[11px] text-tx3">{p}</div>
                  </Td>
                  {ALL_ROLES.map((r) => {
                    const on = view[p].includes(r);
                    const locked = p === "users.manage" && r === "admin";
                    return (
                      <Td key={r} align="center">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--brand)]"
                          checked={on}
                          disabled={!editable || locked}
                          title={locked ? "تظل صلاحية إدارة المستخدمين ممنوحة لمدير النظام دائماً" : undefined}
                          aria-label={`${PERMISSION_LABELS[p]} — ${ROLE_LABELS[r]}`}
                          onChange={(e) => toggle({ perm: p, role: r, on: e.target.checked })}
                        />
                      </Td>
                    );
                  })}
                </Tr>
              ))}
            </TBody>
            <TFoot>
              <Tr>
                <Td className="sticky start-0">عدد الصلاحيات</Td>
                {ALL_ROLES.map((r) => (
                  <Td key={r} align="center"><span className="num">{PERMISSION_KEYS.filter((p) => view[p].includes(r)).length}</span></Td>
                ))}
              </Tr>
            </TFoot>
          </Table>
        </TableWrap>
      </Card>
    </>
  );
}
