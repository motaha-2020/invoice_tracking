import { Boxes, PackageSearch, Receipt } from "lucide-react";
import { Badge, CardFooter, EmptyState, Num, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { formatDate, formatQty } from "@/lib/format";
import type { ComparisonRow } from "../materials.service";

type Material = { id: string; code: string; description: string; unit: string; suppliedBy: string | null; groupName: string | null };

export function CatalogTable({ rows, total }: { rows: Material[]; total: number }) {
  if (!rows.length) {
    return (
      <EmptyState icon={Boxes} title="مفيش أصناف">
        <div className="text-[13px]">ارفع كتالوج المهمات من القالب (07)، أو غيّر كلمة البحث.</div>
      </EmptyState>
    );
  }
  return (
    <>
      <TableWrap>
        <Table>
          <THead>
            <Tr><Th>رقم الشطب</Th><Th>الوصف</Th><Th>الوحدة</Th><Th>التوريد</Th><Th>المجموعة</Th></Tr>
          </THead>
          <TBody>
            {rows.map((m) => (
              <Tr key={m.id}>
                <Td><Num className="font-semibold">{m.code}</Num></Td>
                <Td>{m.description}</Td>
                <Td className="text-sm">{m.unit}</Td>
                <Td className="text-sm">{m.suppliedBy ?? "—"}</Td>
                <Td className="text-sm text-tx3">{m.groupName ?? "—"}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableWrap>
      {total > rows.length && <CardFooter className="text-xs text-tx3">بيظهر أول {rows.length} من {total} — استخدم البحث.</CardFooter>}
    </>
  );
}

type Issue = {
  id: string;
  date: Date;
  ref: string;
  contractNo: string;
  company: string;
  aoNo: string;
  aoName: string;
  code: string;
  description: string;
  unit: string;
  qty: number;
  returned: number;
};

export function IssuesTable({ rows, total }: { rows: Issue[]; total: number }) {
  if (!rows.length) {
    return (
      <EmptyState icon={Receipt} title="مفيش أذون صرف">
        <div className="text-[13px]">مفيش منصرف بالفلتر ده في نطاقك.</div>
      </EmptyState>
    );
  }
  return (
    <>
      <TableWrap>
        <Table>
          <THead>
            <Tr>
              <Th>التاريخ</Th><Th>إذن الصرف</Th><Th>العقد</Th><Th>أمر التكليف</Th><Th>الصنف</Th>
              <Th align="end">المنصرف</Th><Th align="end">المرتجع</Th><Th align="end">الصافي</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((x) => (
              <Tr key={x.id}>
                <Td className="text-sm"><Num>{formatDate(x.date)}</Num></Td>
                <Td>{x.ref}</Td>
                <Td className="text-sm" title={x.company}><Num>{x.contractNo}</Num></Td>
                <Td title={x.aoName}><Num className="font-semibold">{x.aoNo}</Num><div className="max-w-[220px] truncate text-xs text-tx3">{x.aoName}</div></Td>
                <Td><Num className="font-semibold">{x.code}</Num> <span className="text-xs text-tx3">{x.description}</span></Td>
                <Td align="end"><Num>{formatQty(x.qty)}</Num> <span className="text-xs text-tx3">{x.unit}</span></Td>
                <Td align="end">{x.returned ? <Num>{formatQty(x.returned)}</Num> : <span className="text-tx3">—</span>}</Td>
                <Td align="end"><Num className="font-semibold">{formatQty(x.qty - x.returned)}</Num></Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableWrap>
      {total > rows.length && <CardFooter className="text-xs text-tx3">بيظهر أحدث {rows.length} من {total} إذن — استخدم الفلاتر.</CardFooter>}
    </>
  );
}

export function ComparisonTable({ rows, truncated }: { rows: ComparisonRow[]; truncated: boolean }) {
  if (!rows.length) {
    return (
      <EmptyState icon={PackageSearch} title="مفيش مهمات بالفلتر ده">
        <div className="text-[13px]">مفيش مهمات مخططة أو منصرفة أو منفذة على أوامر التكليف دي.</div>
      </EmptyState>
    );
  }
  return (
    <>
      <TableWrap>
        <Table>
          <THead>
            <Tr>
              <Th>أمر التكليف</Th><Th>الصنف</Th>
              <Th align="end">المخطط</Th><Th align="end">المنصرف</Th><Th align="end">المنفذ</Th><Th align="end">المفوتر</Th><Th align="end">الرصيد</Th>
              <Th>ملاحظات</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((r) => {
              const flag = r.flags.some((f) => f.cls === "r") ? "r" : r.flags.length ? "a" : undefined;
              return (
                <Tr key={r.key} flag={flag}>
                  <Td title={r.aoName}>
                    <Num className="font-semibold">{r.aoNo}</Num> <Num className="text-xs text-tx3">{r.contractNo}</Num>
                    <div className="max-w-[220px] truncate text-xs text-tx3">{r.aoName}</div>
                  </Td>
                  <Td>
                    <Num className="font-semibold">{r.code}</Num>
                    <div className="text-xs text-tx3">{r.description} · {r.unit}</div>
                  </Td>
                  <Td align="end"><Num>{formatQty(r.planned)}</Num></Td>
                  <Td align="end"><Num>{formatQty(r.issued)}</Num></Td>
                  <Td align="end" className={r.executed > r.issued ? "text-cr6" : undefined}><Num>{formatQty(r.executed)}</Num></Td>
                  <Td align="end"><Num>{formatQty(r.billed)}</Num></Td>
                  <Td align="end" className={r.balance < 0 ? "text-cr6" : undefined}><Num className="font-semibold">{formatQty(r.balance)}</Num></Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {r.flags.length ? r.flags.map((f) => <Badge key={f.code} tone={f.cls}>{f.text}</Badge>) : <Badge tone="g">مظبوط</Badge>}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </TableWrap>
      <CardFooter className="text-xs text-tx3">
        المنصرف = المصروف من المخازن ناقص المرتجع. المنفذ = مجموع الكميات المنفذة في مستخلصات أمر التكليف (غير المسودات، آخر نسخة). الرصيد = المنصرف − المنفذ.
        {truncated && " — بيظهر أول 100 أمر تكليف بس، استخدم الفلاتر."}
      </CardFooter>
    </>
  );
}
