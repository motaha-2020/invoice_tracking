import { Package } from "lucide-react";
import { Alert, Badge, Card, EmptyState, Num, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { formatQty } from "@/lib/format";
import type { MaterialRow } from "../invoice-calc";

/** تاب المهمات: المخطط / المنصرف / المنفذ السابق / الحالي / التراكمي / المفوتر / الرصيد */
export function MaterialsTab({ materials }: { materials: MaterialRow[] }) {
  if (!materials.length) {
    return <Card><EmptyState icon={Package} title="لا توجد مهمات في هذا المستخلص">لا يتضمن المستخلص بنوداً تستهلك مهمات من توريد الشركة المصرية للاتصالات.</EmptyState></Card>;
  }
  const flagged = materials.filter((m) => m.flags.some((f) => f.cls === "r")).length;
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-tx3">
        المخطط من أمر التكليف · المنصرف من أذون صرف المخازن (بعد خصم المرتجع) · التراكمي = السابق + الحالي · الرصيد = المنصرف − التراكمي
      </div>
      {flagged > 0 && <Alert tone="r" title={<><Num>{flagged}</Num> صنف به ملاحظات جوهرية</>}>يرجى المراجعة مع المخازن قبل الاعتماد.</Alert>}
      <Card>
        <TableWrap>
          <Table className="text-[13px]">
            <THead>
              <tr>
                <Th>رقم الشطب</Th>
                <Th>الصنف</Th>
                <Th>الوحدة</Th>
                <Th align="end">المخطط</Th>
                <Th align="end">المنصرف</Th>
                <Th align="end">المنفذ السابق</Th>
                <Th align="end">المنفذ الحالي</Th>
                <Th align="end">التراكمي</Th>
                <Th align="end">المفوتر</Th>
                <Th align="end">الرصيد</Th>
                <Th>الملاحظات</Th>
              </tr>
            </THead>
            <TBody>
              {materials.map((m) => (
                <Tr key={m.id} flag={m.flags.some((f) => f.cls === "r") ? "r" : m.flags.length ? "a" : undefined}>
                  <Td><Num>{m.code}</Num></Td>
                  <Td className="min-w-[200px]">{m.description}</Td>
                  <Td>{m.unit}</Td>
                  <Td align="end"><Num>{formatQty(m.planned)}</Num></Td>
                  <Td align="end"><Num>{formatQty(m.issued)}</Num></Td>
                  <Td align="end"><Num>{formatQty(m.prevExecuted)}</Num></Td>
                  <Td align="end"><Num>{formatQty(m.executed)}</Num></Td>
                  <Td align="end" className={m.cumExecuted > m.issued ? "font-semibold text-cr6" : undefined}><Num>{formatQty(m.cumExecuted)}</Num></Td>
                  <Td align="end"><Num>{formatQty(m.billed)}</Num></Td>
                  <Td align="end" className={m.balance < 0 ? "font-semibold text-cr6" : undefined}><Num>{formatQty(m.balance)}</Num></Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {m.flags.length ? m.flags.map((f) => <Badge key={f.code} tone={f.cls}>{f.text}</Badge>) : <Badge tone="g">مطابق</Badge>}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </Card>
    </div>
  );
}
