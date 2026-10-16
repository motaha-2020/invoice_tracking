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
        sub="العقود والمقايسات وأوامر التكليف وملاحقها"
        crumbs={[{ label: "الرئيسية", href: "/" }, { label: "العقود وأوامر التكليف" }]}
      />
      <Card>
        <CardHeader title="العقود" sub={<span className="num">{rows.length}</span>} />
        {rows.length === 0 ? (
          <EmptyState icon={FileSignature} title="مفيش عقود لسه">
            <div className="text-[13px]">{canImport ? "ارفع قالب العقد والمقايسة من تحت." : "لسه مفيش عقود متسجلة في نطاقك."}</div>
          </EmptyState>
        ) : (
          <ContractsTable rows={rows} showCompany={!onlyCompany} />
        )}
      </Card>

      {canImport && (
        <section aria-label="رفع العقود وأوامر التكليف" className="mt-5 grid gap-4 xl:grid-cols-2">
          <ImportPanel
            templateId="05_العقد_والمقايسة"
            title="رفع عقد ومقايسة"
            templateFile="05_العقد_والمقايسة.xlsx"
            hint="بيانات العقد وشروط الصرف + المقايسة بالأسعار. البنود الموجودة بتتحدث ومفيش بند بيتمسح."
          />
          <ImportPanel
            templateId="06_أمر_التكليف"
            title="رفع أمر تكليف / ملحق زيادة"
            templateFile="06_أمر_التكليف.xlsx"
            hint="رقم الملحق 0 = الأصلي (الكميات بتتستبدل). 1 وأكتر = ملحق زيادة بيتسجل في تاريخ أمر التكليف."
          />
        </section>
      )}
    </>
  );
}
