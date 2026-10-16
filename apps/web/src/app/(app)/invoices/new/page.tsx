import type { Metadata } from "next";
import { Suspense } from "react";
import { Num, PageHeader, PageSkeleton } from "@/components/ui";
import { NewInvoiceWizard } from "@/features/invoices/components/wizard/new-invoice-wizard";
import { getWizardOptions, loadDraft } from "@/features/invoices/draft.service";
import { requireNavAccess } from "@/features/shell/nav.service";

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export const metadata: Metadata = { title: "مستخلص جديد" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewInvoiceContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewInvoiceContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireNavAccess("inv-new");
  const sp = await searchParams;
  const draftId = typeof sp.draft === "string" ? sp.draft : null;
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit" }).format(new Date()).split("-");
  const defaultPeriod = `${MONTHS[Number(m) - 1]} ${y}`;
  const [opts, draft] = await Promise.all([getWizardOptions(user), draftId ? loadDraft(user, draftId) : null]);
  return (
    <>
      <PageHeader
        title="مستخلص جديد"
        sub={draft ? <>استكمال مسودة المستخلص رقم <Num>{draft.invoiceNo}</Num></> : "تقديم المستخلص في أربع خطوات — الأسعار من التعاقد، ويُحدَّد مسار الاعتماد تلقائياً"}
        crumbs={[{ label: "الرئيسية", href: "/" }, { label: "مستخلص جديد" }]}
      />
      <NewInvoiceWizard key={draft?.draftId ?? "new"} contracts={opts.contracts} workTypes={opts.workTypes} initial={draft} defaultPeriod={defaultPeriod} />
    </>
  );
}
