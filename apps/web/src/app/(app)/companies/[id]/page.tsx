import { Files } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, CardHeader, EmptyState, Num, PageHeader, PageSkeleton } from "@/components/ui";
import { requireUser } from "@/features/auth/session";
import { AoMoneyTable, GroupTable, MoneyOverview, StageBreakdown } from "@/features/insights/components/insights-cards";
import { getCompanyInsights } from "@/features/insights/insights.service";
import { InvoiceTable } from "@/features/invoices/components/invoice-table";
import { getStepNames } from "@/features/invoices/invoices.service";

export const metadata: Metadata = { title: "ملخص المقاول" };

type Params = Promise<{ id: string }>;

export default function CompanyPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CompanyContent params={params} />
    </Suspense>
  );
}

/** ملخص المقاول: القيم + عقوده + أوامر تكليفه + مستخلصاته (في نطاق صلاحية المستخدم) */
async function CompanyContent({ params }: { params: Params }) {
  const user = await requireUser();
  const { id } = await params;
  const [data, steps] = await Promise.all([getCompanyInsights(user, id), getStepNames()]);
  if (!data) notFound();
  const { company, insights, aos, invoices } = data;

  return (
    <>
      <PageHeader
        title={company.name}
        sub={<>{company.fullName}{company.phone && <> · <Num>{company.phone}</Num></>}{company.email && <> · <span dir="ltr">{company.email}</span></>}</>}
        crumbs={[{ label: "الرئيسية", href: "/" }, { label: "المقاولون" }, { label: company.name }]}
      />
      <MoneyOverview t={insights.totals} />
      <StageBreakdown stages={insights.byStage} names={steps} className="mb-4" />
      <GroupTable title="العقود" rows={insights.byContract} labelHead="العقد" href={(g) => `/contracts/${g.id}`} />
      <AoMoneyTable aos={aos} byAo={insights.byAo} />
      <Card className="mt-4">
        <CardHeader title="المستخلصات" sub={<Num>{invoices.length}</Num>} />
        {invoices.length === 0 ? <EmptyState icon={Files} title="لا توجد مستخلصات" /> : <InvoiceTable rows={invoices} steps={steps} showCompany={false} />}
      </Card>
    </>
  );
}
