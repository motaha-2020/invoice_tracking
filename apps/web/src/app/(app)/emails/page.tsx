import { CheckCircle2, Clock, Mail, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert, Badge, Card, CardHeader, EmptyState, Input, Kpi, Num, PageHeader, PageSkeleton } from "@/components/ui";
import { RequeueButton } from "@/features/emails/components/requeue-button";
import { getOutbox } from "@/features/emails/emails.service";
import { EMAIL_STATUS } from "@/features/invoices/components/emails-tab";
import { requireNavAccess } from "@/features/shell/nav.service";
import { cn } from "@/lib/cn";
import { formatCount, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "سجل البريد الإلكتروني" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const STATUSES = ["pending", "sent", "failed"] as const;

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EmailsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function EmailsContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireNavAccess("emails");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const q = typeof sp.q === "string" ? sp.q : "";
  const { rows, counts, smtp } = await getOutbox(user, { status, q });

  return (
    <>
      <PageHeader
        title="سجل البريد الإلكتروني"
        sub="رسائل البريد الإلكتروني الصادرة من المنظومة وحالة إرسالها"
        crumbs={[{ label: "الرئيسية", href: "/" }, { label: "سجل البريد الإلكتروني" }]}
        actions={(counts.failed ?? 0) > 0 ? <RequeueButton ids="allFailed" label="إعادة إرسال المتعذّر" /> : undefined}
      />
      {smtp.configured ? (
        <Alert tone="g" className="mb-4">الإرسال مفعّل عبر الخادم <Num>{smtp.host}</Num>{smtp.from && <> من <Num>{smtp.from}</Num></>} — تُرسل الرسائل خلال دقيقة من إنشائها.</Alert>
      ) : (
        <Alert tone="a" className="mb-4" title="إرسال البريد غير مفعّل">
          لم تُضبط بيانات خادم البريد (SMTP) على السيرفر بعد، لذا تُحفظ الرسائل هنا بحالة «قيد الإرسال» وتُرسل تلقائياً فور ضبطها.
        </Alert>
      )}
      <div className="mb-4 grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        <Kpi icon={Clock} label="قيد الإرسال" value={formatCount(counts.pending ?? 0)} tone={(counts.pending ?? 0) > 0 ? "a" : undefined} href="/emails?status=pending" />
        <Kpi icon={CheckCircle2} label="أُرسلت" value={formatCount(counts.sent ?? 0)} tone="g" href="/emails?status=sent" />
        <Kpi icon={XCircle} label="تعذّر إرسالها" value={formatCount(counts.failed ?? 0)} tone={(counts.failed ?? 0) > 0 ? "r" : undefined} href="/emails?status=failed" />
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-bd1 px-[18px] py-2.5">
          {[undefined, ...STATUSES].map((s) => (
            <Link
              key={s ?? "all"}
              href={s ? `/emails?status=${s}` : "/emails"}
              className={cn(
                "inline-flex h-7 items-center rounded-full border px-3 text-[13px] font-medium no-underline",
                s === status ? "border-brand bg-brand text-white" : "border-bd2 bg-card text-tx2 hover:border-bd3",
              )}
            >
              {s ? EMAIL_STATUS[s].label : "الكل"}
            </Link>
          ))}
          <form className="ms-auto" action="/emails">
            {status && <input type="hidden" name="status" value={status} />}
            <Input name="q" defaultValue={q} placeholder="بحث بالمستلم أو الموضوع…" aria-label="بحث" className="w-64" />
          </form>
        </div>
        <CardHeader title="الرسائل" sub={<><Num>{rows.length}</Num> رسالة (آخر 200)</>} />
        {rows.length === 0 ? (
          <EmptyState icon={Mail} title="لا توجد رسائل" />
        ) : (
          <div className="flex flex-col">
            {rows.map((m) => {
              const st = EMAIL_STATUS[m.status];
              return (
                <details key={m.id} className="border-b border-bd1 last:border-b-0">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-[18px] py-3">
                    <Mail className="size-4 text-tx3" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{m.subject}</div>
                      <div className="text-xs text-tx3">
                        إلى: {m.toName ?? ""} <Num>{`<${m.toEmail}>`}</Num>
                        {m.invoice && <> · <Link href={`/invoices/${m.invoice.id}`}>مستخلص رقم <Num>{m.invoice.invoiceNo}</Num></Link></>}
                      </div>
                    </div>
                    <Num className="text-xs text-tx3">{formatDateTime(m.sentAt ?? m.createdAt)}</Num>
                    {m.attempts > 0 && m.status !== "sent" && <span className="text-xs text-tx3">محاولات: <Num>{m.attempts}</Num></span>}
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {m.status === "failed" && <RequeueButton ids={[m.id]} label="إعادة الإرسال" />}
                  </summary>
                  <div className="whitespace-pre-wrap bg-hover px-[18px] py-3 text-[13px]">{m.body}</div>
                  {m.lastError && <div className="px-[18px] py-2 text-xs text-cr6">آخر خطأ: {m.lastError}</div>}
                </details>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
