import { localDate, HELD_LABELS, type HeldType } from "@it/domain";
import { Banknote, CheckCircle2, Clock, Hourglass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge, Card, CardHeader, EmptyState, Kpi, Money, Num, PageHeader, PageSkeleton, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { hasRole } from "@/features/auth/scope";
import { ReleaseRetentionButton } from "@/features/invoices/components/release-retention";
import { listRetentionsFor, releaseDocTypes } from "@/features/invoices/finance.service";
import { requireNavAccess } from "@/features/shell/nav.service";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "المبالغ المحتجزة" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FILTERS = [
  { key: "pending", label: "محتجز" },
  { key: "released", label: "تم صرفه" },
  { key: "all", label: "الكل" },
] as const;

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RetentionsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function RetentionsContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireNavAccess("retentions");
  const sp = await searchParams;
  const status = FILTERS.find((f) => f.key === sp.status)?.key ?? "pending";
  const type = sp.type === "asbuilt" || sp.type === "handover" ? (sp.type as HeldType) : undefined;
  const [{ rows, totals, canRelease }, asbuiltDocs, handoverDocs] = await Promise.all([
    listRetentionsFor(user, { released: status === "all" ? undefined : status === "released", type }),
    releaseDocTypes("asbuilt"),
    releaseDocTypes("handover"),
  ]);
  const docs = { asbuilt: asbuiltDocs, handover: handoverDocs };
  const isCompany = hasRole(user, "company");
  const today = localDate(new Date());
  const href = (s: string, t?: string) => `/retentions?status=${s}${t ? `&type=${t}` : ""}`;

  return (
    <>
      <PageHeader
        title="المبالغ المحتجزة"
        sub="المحتجز من المستخلصات المسددة لحين تسليم خرائط ما بعد التنفيذ (As-Built) والاستلام الابتدائي — ويُصرف على المستخلص نفسه"
        crumbs={[{ label: "الرئيسية", href: "/" }, { label: "المبالغ المحتجزة" }]}
      />
      <div className="mb-4 grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        <Kpi icon={Hourglass} label="إجمالي المحتجز" value={<>{formatMoney(totals.pending, { decimals: 0 })} <small className="text-sm">جنيه</small></>} href={href("pending")} />
        <Kpi icon={Clock} label="مستحق الصرف" value={<>{formatMoney(totals.ready, { decimals: 0 })} <small className="text-sm">جنيه</small></>} sub="مستنده مرفق ومتاح للصرف" tone={totals.ready > 0 ? "a" : undefined} />
        <Kpi icon={CheckCircle2} label="تم صرفه" value={<>{formatMoney(totals.released, { decimals: 0 })} <small className="text-sm">جنيه</small></>} tone="g" href={href("released")} />
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-bd1 px-[18px] py-2.5">
          {FILTERS.map((f) => (
            <Link key={f.key} href={href(f.key, type)} className={cn("inline-flex h-7 items-center rounded-full border px-3 text-[13px] font-medium no-underline", f.key === status ? "border-brand bg-brand text-white" : "border-bd2 bg-card text-tx2 hover:border-bd3")}>
              {f.label}
            </Link>
          ))}
          <span className="mx-2 h-5 w-px bg-bd2" aria-hidden />
          {([undefined, "asbuilt", "handover"] as const).map((t) => (
            <Link key={t ?? "all"} href={href(status, t)} className={cn("inline-flex h-7 items-center rounded-full border px-3 text-[13px] font-medium no-underline", t === type ? "border-brand bg-brand-soft text-brand-tx" : "border-bd2 bg-card text-tx2 hover:border-bd3")}>
              {t ? HELD_LABELS[t] : "كل الأنواع"}
            </Link>
          ))}
        </div>
        <CardHeader title="المبالغ" sub={<Num>{rows.length}</Num>} />
        {rows.length === 0 ? (
          <EmptyState icon={Banknote} title="لا توجد مبالغ مطابقة" />
        ) : (
          <TableWrap>
            <Table className="text-[13px]">
              <THead>
                <tr>
                  <Th>المستخلص</Th>
                  {!isCompany && <Th>المقاول</Th>}
                  <Th>البند</Th>
                  <Th>تاريخ السداد</Th>
                  <Th align="end">المبلغ</Th>
                  <Th>المستند</Th>
                  <Th>الحالة</Th>
                  <Th />
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => {
                  const t = r.type as HeldType;
                  return (
                    <Tr key={r.id} flag={!r.releasedAt && r.docOk ? "a" : undefined}>
                      <Td>
                        <Link href={`/invoices/${r.invoice.id}?tab=money`} className="font-bold no-underline hover:underline"><Num>{r.invoice.invoiceNo}</Num></Link>
                        <div className="text-xs text-tx3"><Num>{r.invoice.ao.aoNo}</Num> · {r.invoice.pathName}</div>
                      </Td>
                      {!isCompany && <Td>{r.invoice.contract.company.name}</Td>}
                      <Td>{r.name}</Td>
                      <Td><Num>{formatDate(r.invoice.paidAt)}</Num></Td>
                      <Td align="end"><Money>{formatMoney(r.amount)}</Money></Td>
                      <Td>{r.docOk ? <Badge tone="g">مرفق</Badge> : <Badge tone="n">بانتظار {HELD_LABELS[t]}</Badge>}</Td>
                      <Td>
                        {r.releasedAt ? (
                          <span className="text-xs">
                            <Badge tone="g">تم الصرف</Badge>{" "}
                            <Num>{formatDate(r.releasedAt)}</Num> — {r.releaseMethod} <Num>{r.releaseRef}</Num>
                          </span>
                        ) : (
                          <Badge tone="a">محتجز</Badge>
                        )}
                      </Td>
                      <Td>
                        {!r.releasedAt && canRelease && (
                          <ReleaseRetentionButton
                            deductionId={r.id}
                            invoiceId={r.invoice.id}
                            name={r.name}
                            amount={Number(r.amount ?? 0)}
                            docOk={r.docOk}
                            docLabel={HELD_LABELS[t]}
                            docTypes={docs[t]}
                            today={today}
                          />
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
