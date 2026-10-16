import { AlertTriangle, ListX, TrendingUp } from "lucide-react";
import { Alert, Badge, Card, EmptyState, Money, Num, TBody, TFoot, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { formatMoney, formatQty } from "@/lib/format";
import type { InvoiceCalc } from "../invoice-calc";
import { QtyEditButton } from "./qty-edit";

/** تاب البنود: السعر من العقد والمقدم والمعتمد والسابق والتراكمي والمخطط والتجاوز */
export function LinesTab({ invoiceId, calc, canEdit }: { invoiceId: string; calc: InvoiceCalc; canEdit: boolean }) {
  const { lines, summary } = calc;
  if (!lines.length) return <Card><EmptyState icon={ListX} title="لا توجد بنود في هذا المستخلص" /></Card>;
  const over = lines.filter((l) => l.overQty > 0);
  return (
    <div className="flex flex-col gap-3">
      {summary.unpriced > 0 && (
        <Alert tone="r" title={<>يتضمن المستخلص <Num>{summary.unpriced}</Num> بنداً غير مُسعّر في التعاقد (C5)</>}>
          يلزم تسعير البند من التخطيط وموافقة اللجنة العليا قبل إدراجه في الإجمالي.
        </Alert>
      )}
      {over.length > 0 && (
        <Alert tone="a" title={<><Num>{over.length}</Num> بند تجاوزت كميته التراكمية الكمية المخططة في أمر التكليف</>}>
          <span className="inline-flex flex-wrap gap-x-3">
            {over.slice(0, 6).map((l) => (
              <Num key={l.id}>{`${l.itemNo} (+${l.overPct.toFixed(1)}%)`}</Num>
            ))}
          </span>
        </Alert>
      )}
      <div className="text-xs text-tx3">
        الأسعار من التعاقد · «السابق» هو المعتمد في المستخلصات السابقة على أمر التكليف نفسه
        {canEdit && " · يمكنك تعديل الكمية المعتمدة لأي بند مع بيان السبب، ويُسجَّل التعديل في سجل الإجراءات"}
        {summary.changed > 0 && <> · عُدِّلت الكمية المعتمدة لعدد <Num>{summary.changed}</Num> بند</>}
      </div>
      <Card>
        <TableWrap>
          <Table className="text-[13px]">
            <THead>
              <tr>
                <Th>رقم البند</Th>
                <Th>الوصف</Th>
                <Th>الوحدة</Th>
                <Th align="end">سعر الوحدة</Th>
                <Th align="end">المقدم</Th>
                <Th align="end">المعتمد</Th>
                <Th align="end">السابق</Th>
                <Th align="end">التراكمي</Th>
                <Th align="end">المخطط</Th>
                <Th align="end">التجاوز</Th>
                <Th align="end">الإجمالي</Th>
                {canEdit && <Th><span className="sr-only">تعديل</span></Th>}
              </tr>
            </THead>
            <TBody>
              {lines.map((l) => (
                <Tr key={l.id} flag={l.unitPrice == null ? "r" : l.overQty > 0 ? "a" : undefined}>
                  <Td>
                    <b className="num">{l.itemNo}</b>
                    {l.siteCode && <div className="num text-xs text-tx3">{l.siteCode}</div>}
                  </Td>
                  <Td className="min-w-[220px]">
                    {l.description}
                    {l.isNew && <Badge tone="r" className="ms-1.5">بند مستجد</Badge>}
                    {l.notInAo && <Badge tone="a" className="ms-1.5">غير مدرج في أمر التكليف</Badge>}
                    {l.changed && l.approveNote && <div className="text-xs text-tx3">✎ {l.approveNote}</div>}
                  </Td>
                  <Td>{l.unit ?? "—"}</Td>
                  <Td align="end">
                    {l.unitPrice == null ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-cr6"><AlertTriangle className="size-3.5" aria-hidden /> غير مُسعّر</span>
                    ) : (
                      <Num>{formatMoney(l.unitPrice)}</Num>
                    )}
                  </Td>
                  <Td align="end"><Num>{formatQty(l.qty)}</Num></Td>
                  <Td align="end">
                    {l.changed && <s className="num me-1 text-tx3">{formatQty(l.qty)}</s>}
                    <b className="num">{formatQty(l.approvedQty)}</b>
                  </Td>
                  <Td align="end"><Num>{formatQty(l.prevQty)}</Num></Td>
                  <Td align="end" className={l.overQty > 0 ? "font-semibold text-cr6" : undefined}><Num>{formatQty(l.cumQty)}</Num></Td>
                  <Td align="end"><Num>{formatQty(l.plannedQty)}</Num></Td>
                  <Td align="end">
                    {l.overQty > 0 ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-cr6"><TrendingUp className="size-3.5" aria-hidden /><Num>{`+${l.overPct.toFixed(1)}%`}</Num></span>
                    ) : (
                      <span className="text-tx4">—</span>
                    )}
                  </Td>
                  <Td align="end">{l.total == null ? <span className="text-tx4">—</span> : <Money>{formatMoney(l.total)}</Money>}</Td>
                  {canEdit && (
                    <Td align="center">
                      <QtyEditButton
                        invoiceId={invoiceId}
                        line={{ id: l.id, itemNo: l.itemNo, description: l.description, unit: l.unit, qty: l.qty, approvedQty: l.approvedQty, plannedQty: l.plannedQty, prevQty: l.prevQty }}
                      />
                    </Td>
                  )}
                </Tr>
              ))}
            </TBody>
            <TFoot>
              <tr>
                <Td colSpan={10}>
                  إجمالي المعتمد <span className="text-xs font-normal">(المقدم من المقاول: <Num>{formatMoney(summary.submitted)}</Num>)</span>
                </Td>
                <Td align="end"><Money>{formatMoney(summary.gross)}</Money></Td>
                {canEdit && <Td />}
              </tr>
            </TFoot>
          </Table>
        </TableWrap>
      </Card>
    </div>
  );
}
