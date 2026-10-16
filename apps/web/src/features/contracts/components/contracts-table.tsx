import Link from "next/link";
import { Money, Num, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { formatCount, formatMoney } from "@/lib/format";
import { RecordActions } from "@/features/records/components/record-actions";
import type { ContractSummary } from "../contracts.service";

export function ContractsTable({ rows, showCompany = true, canManage = false }: { rows: ContractSummary[]; showCompany?: boolean; canManage?: boolean }) {
  return (
    <TableWrap>
      <Table>
        <THead>
          <tr>
            <Th>العقد</Th>
            {showCompany && <Th>المقاول</Th>}
            <Th align="end">البنود</Th>
            <Th align="end">أوامر التكليف</Th>
            <Th align="end">قيمة أوامر التكليف</Th>
            <Th align="end">القيمة المفوترة</Th>
            <Th>شروط السداد</Th>
            {canManage && <Th><span className="sr-only">إجراءات</span></Th>}
          </tr>
        </THead>
        <TBody>
          {rows.map((c) => (
            <Tr key={c.id} interactive>
              <Td>
                <Link href={`/contracts/${c.id}`} className="font-bold text-brand-tx no-underline hover:underline">
                  <Num>{c.contractNo}</Num>
                </Link>
                <div className="max-w-[340px] truncate text-xs text-tx3" title={c.title}>{c.title}</div>
              </Td>
              {showCompany && <Td>{c.companyName}</Td>}
              <Td align="end"><Num>{formatCount(c.items)}</Num></Td>
              <Td align="end"><Num>{formatCount(c.aos)}</Num></Td>
              <Td align="end">
                <Money>{formatMoney(c.aoTotal, { decimals: 0 })}</Money>
                {c.contractValue != null && (
                  <div className="text-xs text-tx3">
                    من <Num>{formatMoney(c.contractValue, { decimals: 0 })}</Num>
                  </div>
                )}
              </Td>
              <Td align="end"><Money>{formatMoney(c.billed, { decimals: 0 })}</Money></Td>
              <Td className="text-[13px]"><span dir="ltr" className="num">{c.terms}</span></Td>
              {canManage && (
                <Td className="whitespace-nowrap">
                  <RecordActions entity="contract" id={c.id} name={c.contractNo} editHref={`/contracts/${c.id}`} deleteWarning="سيُحذف العقد مع جدول الكميات وجميع أوامر التكليف والمرفقات. لا يمكن الحذف إذا كان على العقد مستخلصات." />
                </Td>
              )}
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  );
}
