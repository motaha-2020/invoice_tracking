import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { hasRole } from "@/features/auth/scope";
import { InvoiceTable } from "@/features/invoices/components/invoice-table";
import { getStepNames, listInbox } from "@/features/invoices/invoices.service";
import { requireNavAccess } from "@/features/shell/nav.service";

export const metadata: Metadata = { title: "المهام الواردة" };

export default function InboxPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InboxContent />
    </Suspense>
  );
}

async function InboxContent() {
  const user = await requireNavAccess("inbox", "co-returned");
  const [rows, steps] = await Promise.all([listInbox(user), getStepNames()]);
  const isCompany = hasRole(user, "company");

  return (
    <>
      <PageHeader
        title={isCompany ? "بانتظار استيفاء الملاحظات" : "المهام الواردة"}
        sub={isCompany ? "المستخلصات المعادة للاستيفاء والمسودات" : "المستخلصات المعروضة حالياً لاتخاذ إجرائك"}
        crumbs={[{ label: "الرئيسية", href: "/" }, { label: isCompany ? "بانتظار استيفاء الملاحظات" : "المهام الواردة" }]}
      />
      <Card>
        <CardHeader title="المستخلصات" sub={<span className="num">{rows.length}</span>} />
        {rows.length === 0 ? (
          <EmptyState icon={Inbox} title="لا توجد مستخلصات بانتظار إجرائك">
            <div className="text-[13px]">ستظهر هنا المستخلصات فور وصولها إلى مرحلة الاعتماد الخاصة بك.</div>
          </EmptyState>
        ) : (
          <InvoiceTable rows={rows} steps={steps} showCompany={!isCompany} />
        )}
      </Card>
    </>
  );
}
