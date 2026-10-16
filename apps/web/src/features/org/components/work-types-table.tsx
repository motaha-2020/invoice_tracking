import { Hammer } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Num, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import type { WorkTypeRow } from "../org.service";
import { AddButton, RowActions } from "./org-buttons";

/** أنواع الأعمال — نوع المستخلص (مدني، كهرباء، تخطيط ...). التخطيط بيتصرف كله من غير محجوز */
export function WorkTypesTable({ workTypes, canEdit }: { workTypes: WorkTypeRow[]; canEdit: boolean }) {
  return (
    <Card>
      <CardHeader title="أنواع الأعمال" sub="يُحدَّد نوع الأعمال على المستخلص — ويُسدَّد مستخلص التخطيط بنسبة 100% بعد الانتهاء (دون مبالغ محتجزة لخرائط As-Built أو للاستلام الابتدائي)" />
      {workTypes.length === 0 ? (
        <EmptyState icon={Hammer} title="لا توجد أنواع أعمال" action={<AddButton kind="workType" label="إضافة أول نوع أعمال" />} />
      ) : (
        <TableWrap>
          <Table className="text-sm">
            <THead>
              <Tr>
                <Th align="end">الترتيب</Th>
                <Th>الكود</Th>
                <Th>النوع</Th>
                <Th>السداد</Th>
                <Th>الحالة</Th>
                <Th align="end">مستخلصات</Th>
                {canEdit && <Th><span className="sr-only">إجراءات</span></Th>}
              </Tr>
            </THead>
            <TBody>
              {workTypes.map((w) => (
                <Tr key={w.id} className={w.active ? undefined : "opacity-60"}>
                  <Td align="end"><Num>{w.sort}</Num></Td>
                  <Td className="num whitespace-nowrap text-xs text-tx2">{w.code}</Td>
                  <Td><b className="font-semibold">{w.name}</b></Td>
                  <Td>{w.isPlanning ? <Badge tone="b">تخطيط — 100% بعد الانتهاء</Badge> : <span className="text-xs text-tx3">وفق نسب العقد</span>}</Td>
                  <Td>{w.active ? <Badge tone="g">نشط</Badge> : <Badge tone="n">غير نشط</Badge>}</Td>
                  <Td align="end"><Num>{w.invoices}</Num></Td>
                  {canEdit && (
                    <Td align="end" className="whitespace-nowrap">
                      <RowActions
                        kind="workType"
                        record={{ id: w.id, code: w.code, name: w.name, isPlanning: w.isPlanning ? "1" : "", active: w.active ? "1" : "", sort: String(w.sort) }}
                      />
                    </Td>
                  )}
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </Card>
  );
}
