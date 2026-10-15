import type { InvoiceStatus } from "@it/db";
import { Files } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardHeader, EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { hasRole } from "@/features/auth/scope";
import { requireUser } from "@/features/auth/session";
import { InvoiceTable } from "@/features/invoices/components/invoice-table";
import { getStepNames, listVisibleInvoices, parseStatus } from "@/features/invoices/invoices.service";
import { cn } from "@/lib/cn";
import { INVOICE_STATUS } from "@/lib/labels";

export const metadata: Metadata = { title: "كل المستخلصات" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InvoicesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function InvoicesContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const status = parseStatus((await searchParams).status);
  const [rows, steps] = await Promise.all([listVisibleInvoices(user, { status }), getStepNames()]);
  const isCompany = hasRole(user, "company");

  const chips: (InvoiceStatus | undefined)[] = [undefined, "active", "returned", "on_hold", "paid", ...(isCompany ? (["draft"] as const) : [])];

  return (
    <>
      <PageHeader
        title="كل المستخلصات"
        sub="كل المستخلصات اللي في نطاقك"
        crumbs={[{ label: "الرئيسية", href: "/" }, { label: "كل المستخلصات" }]}
      />
      <Card>
        <div className="flex flex-wrap gap-1.5 border-b border-bd1 px-[18px] py-2.5">
          {chips.map((c) => {
            const on = c === status;
            return (
              <Link
                key={c ?? "all"}
                href={c ? `/invoices?status=${c}` : "/invoices"}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "inline-flex h-7 items-center rounded-full border px-3 text-[13px] font-medium no-underline",
                  on ? "border-brand bg-brand text-white" : "border-bd2 bg-card text-tx2 hover:border-bd3",
                )}
              >
                {c ? INVOICE_STATUS[c].label : "الكل"}
              </Link>
            );
          })}
        </div>
        <CardHeader title="المستخلصات" sub={<span className="num">{rows.length}</span>} />
        {rows.length === 0 ? (
          <EmptyState icon={Files} title="مفيش مستخلصات">
            <div className="text-[13px]">مفيش مستخلصات بالفلتر ده في نطاقك.</div>
          </EmptyState>
        ) : (
          <InvoiceTable rows={rows} steps={steps} showCompany={!isCompany} />
        )}
      </Card>
    </>
  );
}
