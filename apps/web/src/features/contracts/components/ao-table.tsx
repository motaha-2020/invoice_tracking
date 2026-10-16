import Link from "next/link";
import { Badge, Money, Num, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { formatCount, formatMoney } from "@/lib/format";
import { AO_STATUS } from "../contracts.labels";
import type { AoSummary } from "../contracts.service";
import { CommitmentMeter } from "./commitment-meter";

export function AoTable({ contractId, rows }: { contractId: string; rows: AoSummary[] }) {
  return (
    <TableWrap>
      <Table>
        <THead>
          <tr>
            <Th>أمر التكليف</Th>
            <Th>المشروع / السنترال</Th>
            <Th>الحالة</Th>
            <Th align="end">القيمة</Th>
            <Th align="end">الالتزام المالي</Th>
            <Th>المفوتر من الالتزام</Th>
            <Th align="end">المواقع</Th>
            <Th align="end">المستخلصات</Th>
          </tr>
        </THead>
        <TBody>
          {rows.map((a) => {
            const st = AO_STATUS[a.status];
            const flag = a.commitment?.level === "exceeded" ? "r" : a.commitment?.level === "warn" ? "a" : undefined;
            return (
              <Tr key={a.id} flag={flag}>
                <Td>
                  <Link href={`/contracts/${contractId}/aos/${a.id}`} className="font-bold text-brand-tx no-underline hover:underline">
                    <Num>{a.aoNo}</Num>
                  </Link>
                  <div className="max-w-[300px] truncate text-xs text-tx3" title={a.name}>{a.name}</div>
                </Td>
                <Td className="text-[13px]">
                  <div>{a.project ?? <span className="text-tx3">مش مربوط بمشروع</span>}</div>
                  <div className="max-w-[240px] truncate text-xs text-tx3">{a.central ?? "—"}</div>
                </Td>
                <Td><Badge tone={st.tone} dot>{st.label}</Badge></Td>
                <Td align="end"><Money>{formatMoney(a.value, { decimals: 0 })}</Money></Td>
                <Td align="end">
                  <Num>{formatMoney(a.financialCommitment, { decimals: 0 })}</Num>
                  {a.commitment?.partial && <div className="text-[11px] text-wa7">أقل من القيمة</div>}
                </Td>
                <Td>{a.commitment ? <CommitmentMeter state={a.commitment} compact /> : <span className="text-tx3">—</span>}</Td>
                <Td align="end"><Num>{formatCount(a.sites)}</Num></Td>
                <Td align="end"><Num>{formatCount(a.invoices)}</Num></Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </TableWrap>
  );
}
