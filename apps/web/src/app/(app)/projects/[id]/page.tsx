import { Files } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, CardHeader, EmptyState, Num, PageHeader, PageSkeleton } from "@/components/ui";
import { requireUser } from "@/features/auth/session";
import { hasRole } from "@/features/auth/scope";
import { AoMoneyTable, MoneyOverview, StageBreakdown } from "@/features/insights/components/insights-cards";
import { getProjectInsights } from "@/features/insights/insights.service";
import { InvoiceTable } from "@/features/invoices/components/invoice-table";
import { getStepNames } from "@/features/invoices/invoices.service";

export const metadata: Metadata = { title: "ملخص المشروع" };

type Params = Promise<{ id: string }>;

export default function ProjectPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProjectContent params={params} />
    </Suspense>
  );
}

/** ملخص المشروع: أوامر التكليف عليه (بعقودها) وكل المستخلصات — كل مستخلص بعقده وأمر تكليفه */
async function ProjectContent({ params }: { params: Params }) {
  const user = await requireUser();
  const { id } = await params;
  const [data, steps] = await Promise.all([getProjectInsights(user, id), getStepNames()]);
  if (!data) notFound();
  const { project, insights, aos, invoices } = data;
  const c = project.central;
  const place = [c.name, c.dept.name, c.dept.generalDept.name, c.dept.generalDept.sector.name].join(" ← ");

  return (
    <>
      <PageHeader
        title={<>{project.name} <span className="num text-base font-semibold text-tx3">{project.code}</span></>}
        sub={<>{project.type.name} · {place}</>}
        crumbs={[{ label: "الرئيسية", href: "/" }, { label: "المشروعات", href: "/org?tab=projects" }, { label: project.name }]}
      />
      <MoneyOverview t={insights.totals} showContracts={false} />
      <StageBreakdown stages={insights.byStage} names={steps} className="mb-4" />
      <AoMoneyTable aos={aos} byAo={insights.byAo} showCompany={!hasRole(user, "company")} showProject={false} />
      <Card className="mt-4">
        <CardHeader title="المستخلصات على المشروع" sub={<Num>{invoices.length}</Num>} />
        {invoices.length === 0 ? <EmptyState icon={Files} title="لا توجد مستخلصات على هذا المشروع" /> : <InvoiceTable rows={invoices} steps={steps} showCompany={!hasRole(user, "company")} />}
      </Card>
    </>
  );
}
