import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge, Card, CardBody, CardHeader, CategoryBadge, Num, PageHeader, PageSkeleton, SlaChip, TabLinks } from "@/components/ui";
import { requireUser } from "@/features/auth/session";
import { CompanyUpdatePanel } from "@/features/invoices/components/company-update";
import { EmailsTab } from "@/features/invoices/components/emails-tab";
import { FilesTab } from "@/features/invoices/components/files-tab";
import { InvoiceActions } from "@/features/invoices/components/invoice-actions";
import { InvoiceStepper } from "@/features/invoices/components/invoice-stepper";
import { InvoiceCallouts, InvoiceSummary } from "@/features/invoices/components/invoice-summary";
import { LinesTab } from "@/features/invoices/components/lines-tab";
import { LogTab } from "@/features/invoices/components/log-tab";
import { MaterialsTab } from "@/features/invoices/components/materials-tab";
import { MoneyTab } from "@/features/invoices/components/money-tab";
import { getInvoiceView, type InvoiceView } from "@/features/invoices/invoice-view.service";
import { RecordActions } from "@/features/records/components/record-actions";
import { invoiceForm } from "@/features/records/records.service";
import { localDate } from "@it/domain";
import { formatMoney } from "@/lib/format";
import { INVOICE_STATUS } from "@/lib/labels";

export const metadata: Metadata = { title: "المستخلص" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TABS = ["lines", "materials", "files", "money", "log", "emails"] as const;
type Tab = (typeof TABS)[number];

export default function InvoicePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InvoiceContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function InvoiceContent({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const user = await requireUser();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const v = await getInvoiceView(user, id);
  if (!v) notFound();
  const { inv, calc } = v;
  const form = await invoiceForm(user, inv.id);
  const tab: Tab = (TABS as readonly string[]).includes(String(sp.tab)) && !(sp.tab === "emails" && v.isCompany) ? (sp.tab as Tab) : "lines";
  const st = INVOICE_STATUS[inv.status];
  const cat = inv.category ?? null;

  const tabs = [
    { key: "lines", label: "البنود", count: calc.lines.length },
    { key: "materials", label: "المهمات", count: calc.materials.length },
    { key: "files", label: v.missingDocs.length ? `المرفقات (ناقص ${v.missingDocs.length})` : "المرفقات", count: v.revision?.attachments.length ?? 0 },
    { key: "money", label: "الماليات" },
    { key: "log", label: "سجل الإجراءات", count: inv.log.length },
    ...(v.isCompany ? [] : [{ key: "emails", label: "البريد الإلكتروني", count: v.emails.length }]),
  ];

  return (
    <>
      <PageHeader
        title={<>مستخلص {inv.contract.company.name} رقم <Num>{inv.invoiceNo}</Num></>}
        sub={
          <>
            {inv.pathName || inv.ao.project?.name}
            <span className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={st.tone} dot>{st.label}</Badge>
              <CategoryBadge code={cat} suggested={inv.suggestedCategory ?? calc.suggestion.category} />
              {inv.status !== "draft" && inv.status !== "paid" && <SlaChip tone={v.sla.cls} label={v.sla.label} elapsed={v.sla.elapsed} sla={v.sla.sla} />}
              {inv.workType && <Badge>{inv.workType.name}</Badge>}
              <span className="text-xs text-tx3">لدى: {v.holder}</span>
            </span>
          </>
        }
        crumbs={[
          { label: "الرئيسية", href: "/" },
          v.isCompany ? { label: "جميع المستخلصات", href: "/invoices" } : { label: "المهام الواردة", href: "/inbox" },
          { label: `مستخلص رقم ${inv.invoiceNo}` },
        ]}
        actions={
          form ? (
            <RecordActions entity="invoice" id={inv.id} name={inv.invoiceNo} form={form} labeled afterDeleteHref="/invoices" deleteWarning="سيُحذف المستخلص مع بنوده ومهماته ومرفقاته وسجل إجراءاته." />
          ) : undefined
        }
      />

      <Card className="mb-4">
        <CardHeader
          title="مسار المستخلص"
          sub={
            <>
              {v.tentative ? `مبدئي على الفئة ${v.pathCategory}` : `فئة ${v.pathCategory} — ${v.categories.find((c) => c.code === v.pathCategory)?.name ?? ""}`} ·{" "}
              <Num>{v.path.length}</Num> مرحلة · إجمالي المدة المستهدفة <Num>{v.totalSla}</Num> يوم عمل
            </>
          }
        />
        <CardBody>
          <InvoiceStepper
            path={v.path}
            status={inv.status}
            currentStep={inv.currentStep}
            returnTo={inv.returnTo}
            returnedFrom={inv.returnedFrom}
            heldAt={inv.heldAt}
            daysByStep={v.daysByStep}
            sla={v.sla}
            submittedAt={inv.submittedAt}
            tentative={v.tentative}
          />
          <InvoiceCallouts v={v} />
        </CardBody>
      </Card>

      <Card className="mb-4">
        <CardHeader title="بيانات المستخلص" />
        <CardBody>
          <InvoiceSummary v={v} />
        </CardBody>
      </Card>

      {v.access.companyResubmit && (
        <CompanyUpdatePanel
          invoiceId={inv.id}
          attachments={(v.revision?.attachments ?? []).map((a) => ({ id: a.id, fileName: a.fileName, size: a.size, uploadedAt: a.uploadedAt.toISOString(), docTypeId: a.docType?.id ?? null }))}
          docTypes={v.docTypes}
          missingDocs={v.requiredDocs.filter((d) => !d.have)}
        />
      )}

      <TabLinks base={`/invoices/${inv.id}`} tabs={tabs} current={tab} />
      <div role="tabpanel">
        {tab === "lines" && <LinesTab invoiceId={inv.id} calc={calc} canEdit={v.access.canEditQty} />}
        {tab === "materials" && <MaterialsTab materials={calc.materials} />}
        {tab === "files" && <FilesTab revision={v.revision} revisions={inv.revisions} requiredDocs={v.requiredDocs} projectType={inv.ao.project?.type.name ?? null} />}
        {tab === "money" && <MoneyTab calc={calc} inv={inv} editor={v.deductionEditor} retention={v.retention} today={localDate(new Date())} />}
        {tab === "log" && <LogTab inv={inv} steps={v.steps} />}
        {tab === "emails" && <EmailsTab emails={v.emails} />}
      </div>

      <InvoiceActions {...actionsProps(v)} />
    </>
  );
}

function actionsProps(v: InvoiceView) {
  const { inv, calc } = v;
  const i = v.path.findIndex((p) => p.key === inv.currentStep);
  const next = i >= 0 ? (v.path[i + 1] ?? null) : null;
  const lastReturn = [...inv.log].reverse().find((e) => e.action === "return");
  return {
    invoiceId: inv.id,
    access: v.access,
    status: inv.status,
    holder: v.holder,
    sla: { tone: v.sla.cls, label: v.sla.label, elapsed: v.sla.elapsed, sla: v.sla.sla },
    next: next ? { name: next.name, sla: next.sla } : null,
    category: inv.category,
    suggestion: { category: calc.suggestion.category, reasons: calc.suggestion.reasons },
    categories: v.categories,
    returnTargets: v.returnTargets,
    returnReasons: v.returnReasons,
    resubmitTo: inv.returnedFrom ? (v.steps[inv.returnedFrom]?.name ?? inv.returnedFrom) : null,
    lastReturnNote: lastReturn?.note ?? null,
    net: formatMoney(calc.totals.net),
    payBlocked: v.payBlocked,
    netWords: calc.totals.words,
  };
}
