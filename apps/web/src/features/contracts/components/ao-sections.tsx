import { Badge, Card, CardHeader, EmptyState, Money, Num, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { AO_CHANGE_KIND } from "../contracts.labels";
import type { AoItemView, AoView } from "../contracts.service";

/** تاريخ أمر التكليف: الملاحق وتجديدات الالتزام */
export function AoChangesTimeline({ changes }: { changes: AoView["ao"]["changes"] }) {
  return (
    <Card>
      <CardHeader title="ملاحق أمر التكليف وتعزيزات الارتباط المالي" sub={<span className="num">{changes.length}</span>} />
      {changes.length === 0 ? (
        <EmptyState title="لا توجد ملاحق أو تعزيزات">
          <div className="text-[13px]">أمر التكليف بقيمته الأصلية.</div>
        </EmptyState>
      ) : (
        <ol className="m-0 list-none space-y-0 px-[18px] py-4 max-sm:px-3">
          {changes.map((ch) => {
            const k = AO_CHANGE_KIND[ch.kind];
            return (
              <li key={ch.id} className="relative border-s-2 border-bd2 pb-4 ps-4 last:pb-0">
                <span aria-hidden className="absolute -start-[6px] top-1 size-2.5 rounded-full bg-brand" />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={k.tone}>{k.label}</Badge>
                  <Num className="text-xs text-tx3">{formatDate(ch.changeDate)}</Num>
                  {ch.reference && <span className="text-xs text-tx3">{ch.reference}</span>}
                </div>
                <div className="mt-1 text-[13px]">
                  <Num>{formatMoney(ch.baseValue, { decimals: 0 })}</Num>
                  {ch.increase != null && (
                    <>
                      {" "}+ <Num className="font-semibold text-ok7">{formatMoney(ch.increase, { decimals: 0 })}</Num>
                    </>
                  )}{" "}
                  ← <Money>{formatMoney(ch.newTotal, { decimals: 0 })}</Money>
                </div>
                {ch.note && <div className="mt-0.5 text-xs text-tx3">{ch.note}</div>}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

/** البنود المخططة مقابل المفوتر التراكمي — التجاوز للكمية المخططة بالأحمر */
export function AoItemsTable({ items }: { items: AoItemView[] }) {
  const showSite = items.some((i) => i.site);
  return (
    <TableWrap className="max-h-[640px] overflow-y-auto">
      <Table>
        <THead>
          <tr>
            {showSite && <Th>الموقع</Th>}
            <Th>البند</Th>
            <Th>الوحدة</Th>
            <Th align="end">سعر الوحدة</Th>
            <Th align="end">الكمية المخططة</Th>
            <Th align="end">الكمية المفوترة التراكمية</Th>
            <Th align="end">المتبقي</Th>
          </tr>
        </THead>
        <TBody>
          {items.map((i) => (
            <Tr key={i.id} flag={i.over ? "r" : undefined} className={i.over ? "[&>td]:bg-cr1/40" : undefined}>
              {showSite && <Td><Num>{i.site ?? "—"}</Num></Td>}
              <Td>
                <Num className="font-semibold">{i.itemNo}</Num>
                <div className="line-clamp-1 max-w-[460px] text-xs text-tx3" title={i.description}>{i.description}</div>
              </Td>
              <Td className="text-[13px]">{i.unit ?? ""}</Td>
              <Td align="end">{i.unitPrice == null ? <Badge tone="a">غير مُسعّر</Badge> : <Num>{formatMoney(i.unitPrice)}</Num>}</Td>
              <Td align="end"><Num>{formatQty(i.planned)}</Num></Td>
              <Td align="end">
                <Num className={i.over ? "font-bold text-cr7" : undefined}>{formatQty(i.billed)}</Num>
                {i.over && <div className="text-[11px] text-cr7">تجاوز للكمية المخططة</div>}
              </Td>
              <Td align="end"><Num className={i.over ? "text-cr7" : "text-tx2"}>{formatQty(i.planned - i.billed)}</Num></Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  );
}

export function AoSitesCard({ sites }: { sites: AoView["ao"]["sites"] }) {
  if (!sites.length) return null;
  return (
    <Card>
      <CardHeader title="المواقع / الكابينات" sub={<span className="num">{sites.length}</span>} />
      <div className="flex flex-wrap gap-1.5 px-[18px] py-3.5 max-sm:px-3">
        {sites.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5 rounded-base border border-bd2 bg-hover px-2 py-1 text-[13px]" title={s.name ?? undefined}>
            <Num className="font-semibold">{s.code}</Num>
            <span className="text-xs text-tx3"><Num>{s._count.aoItems}</Num> بند</span>
          </span>
        ))}
      </div>
    </Card>
  );
}

export function AoMaterialsCard({ materials }: { materials: AoView["ao"]["materials"] }) {
  return (
    <Card>
      <CardHeader title="المهمات المخططة" sub={<span className="num">{materials.length}</span>} />
      {materials.length === 0 ? (
        <EmptyState title="لا توجد مهمات مخططة على أمر التكليف" />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th>رقم الشطب</Th>
                <Th>الصنف</Th>
                <Th>الوحدة</Th>
                <Th align="end">الكمية المخططة</Th>
              </tr>
            </THead>
            <TBody>
              {materials.map((m) => (
                <Tr key={m.id}>
                  <Td><Num>{m.material.code}</Num></Td>
                  <Td className="text-[13px]">{m.material.description}</Td>
                  <Td className="text-[13px]">{m.material.unit}</Td>
                  <Td align="end"><Num>{formatQty(m.plannedQty)}</Num></Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </Card>
  );
}
