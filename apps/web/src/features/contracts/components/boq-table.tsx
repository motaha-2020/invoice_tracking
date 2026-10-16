import { Badge, Num, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney, formatQty } from "@/lib/format";
import type { BoqRow } from "../contracts.service";

/** المقايسة المتدرجة: صفوف العناوين بخلفية، والمسافة حسب المستوى */
export function BoqTable({ rows }: { rows: BoqRow[] }) {
  return (
    <TableWrap className="max-h-[640px] overflow-y-auto">
      <Table>
        <THead>
          <tr>
            <Th>رقم البند</Th>
            <Th>البيان</Th>
            <Th>الوحدة</Th>
            <Th align="end">كمية العقد</Th>
            <Th align="end">سعر الوحدة</Th>
            <Th>نوع العمل</Th>
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
                  <Badge tone="a" title="أي فوترة على البند ده = فئة C5">مالوش سعر</Badge>
                ) : (
                  <Num>{formatMoney(r.unitPrice)}</Num>
                )}
              </Td>
              <Td className="whitespace-nowrap text-xs text-tx3">{r.workType ?? ""}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  );
}
