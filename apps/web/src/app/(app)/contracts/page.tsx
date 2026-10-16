import { FileSignature } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { can } from "@/features/auth/permissions";
import { hasRole } from "@/features/auth/scope";
import { ContractsTable } from "@/features/contracts/components/contracts-table";
import { listContractsFor } from "@/features/contracts/contracts.service";
import { ImportPanel } from "@/features/imports/components/import-panel";
import { requireNavAccess } from "@/features/shell/nav.service";

export const metadata: Metadata = { title: "العقود وأوامر التكليف" };

export default function ContractsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ContractsContent />
    </Suspense>
  );
}

async function ContractsContent() {
  const user = await requireNavAccess("contracts");
  const [rows, canImport] = await Promise.all([listContractsFor(user), can(user, "master.import")]);
  const onlyCompany = user.roles.every((r) => r.role === "company") && hasRole(user, "company");

  return (
    <>
      <PageHeader
        title="العقود وأوامر التكليف"
        sub="العقود وجداول الكميات والأسعار وأوامر التكليف وملاحقها"
        crumbs={[{ label: "الرئيسية", href: "/" }, { label: "العقود وأوامر التكليف" }]}
      />
      <Card>
        <CardHeader title="العقود" sub={<span className="num">{rows.length}</span>} />
        {rows.length === 0 ? (
          <EmptyState icon={FileSignature} title="لا توجد عقود بعد">
            <div className="text-[13px]">{canImport ? "يرجى رفع نموذج العقد وجدول الكميات من القسم أدناه." : "لا توجد عقود مسجلة ضمن نطاق صلاحيتك."}</div>
          </EmptyState>
        ) : (
          <ContractsTable rows={rows} showCompany={!onlyCompany} />
        )}
      </Card>

      {canImport && (
        <section aria-label="استيراد العقود وأوامر التكليف" className="mt-5 grid gap-4 xl:grid-cols-2">
          <ImportPanel
            templateId="05_العقد_والمقايسة"
            title="استيراد عقد وجدول كميات"
            templateFile="05_العقد_والمقايسة.xlsx"
            hint="بيانات العقد وشروط السداد وجدول الكميات والأسعار. تُحدَّث البنود الموجودة ولا يُحذف أي بند."
          />
          <ImportPanel
            templateId="06_أمر_التكليف"
            title="استيراد أمر تكليف / ملحق أمر تكليف"
            templateFile="06_أمر_التكليف.xlsx"
            hint="رقم الملحق 0 = أمر التكليف الأصلي (تُستبدل الكميات). 1 فأكثر = ملحق زيادة يُسجَّل في سجل أمر التكليف."
          />
        </section>
      )}
    </>
  );
}
