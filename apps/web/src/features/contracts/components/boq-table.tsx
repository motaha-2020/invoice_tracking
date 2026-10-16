import { Badge, Num, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney, formatQty } from "@/lib/format";
import { RecordActions } from "@/features/records/components/record-actions";
import { CONTRACT_ITEM_FIELDS } from "@/features/records/records.fields";
import type { BoqRow } from "../contracts.service";

const itemValues = (r: BoqRow) => ({
  itemNo: r.itemNo,
  unit: r.unit ?? "",
  isGroup: r.isGroup ? "1" : "",
  description: r.description,
  contractQty: r.contractQty == null ? "" : String(r.contractQty),
  unitPrice: r.unitPrice == null ? "" : String(r.unitPrice),
  workType: r.workType ?? "",
});

/** المقايسة المتدرجة: صفوف العناوين بخلفية، والمسافة حسب المستوى */
/** canManage = أزرار التعديل والحذف لكل بند (مدير النظام) */
export function BoqTable({ rows, canManage = false }: { rows: BoqRow[]; canManage?: boolean }) {
  return (
    <TableWrap className="max-h-[640px] overflow-y-auto">
      <Table>
        <THead>
          <tr>
            <Th>رقم البند</Th>
            <Th>البيان</Th>
            <Th>الوحدة</Th>
            <Th align="end">الكمية التعاقدية</Th>
            <Th align="end">سعر الوحدة</Th>
            <Th>نوع العمل</Th>
            {canManage && <Th><span className="sr-only">إجراءات</span></Th>}
          </tr>
        </THead>
        <TBody>
          {rows.map((r) => (
            <Tr key={r.id} className={r.isGroup ? "[&>td]:bg-brand-soft" : undefined}>
              <Td className="whitespace-nowrap">
                <Num className={cn(r.isGroup && "font-bold text-brand-tx")}>{r.itemNo}</Num>
              </Td>
              <Td style={{ paddingInlineStart: `${12 + (r.level - 1) * 14}px` }}>
                <div className={cn("line-clamp-2 max-w-[620px] text-[13px]", r.isGroup && (r.level === 1 ? "font-bold" : "font-semibold"))} title={r.description}>
                  {r.description}
                </div>
              </Td>
              <Td className="text-[13px]">{r.unit ?? ""}</Td>
              <Td align="end"><Num>{r.isGroup ? "" : formatQty(r.contractQty)}</Num></Td>
              <Td align="end">
                {r.isGroup ? null : r.unitPrice == null ? (
                  <Badge tone="a" title="أي فوترة على هذا البند تُصنَّف ضمن الفئة C5">غير مُسعّر</Badge>
                ) : (
                  <Num>{formatMoney(r.unitPrice)}</Num>
                )}
              </Td>
              <Td className="whitespace-nowrap text-xs text-tx3">{r.workType ?? ""}</Td>
              {canManage && (
                <Td className="whitespace-nowrap">
                  <RecordActions entity="contractItem" id={r.id} name={r.itemNo} form={{ fields: CONTRACT_ITEM_FIELDS, values: itemValues(r) }} />
                </Td>
              )}
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  );
}
