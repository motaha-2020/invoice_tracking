import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { hasRole } from "@/features/auth/scope";
import { InvoiceTable } from "@/features/invoices/components/invoice-table";
import { getStepNames, listInbox } from "@/features/invoices/invoices.service";
import { requireNavAccess } from "@/features/shell/nav.service";

export const metadata: Metadata = { title: "صندوق الوارد" };

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
        title={isCompany ? "مطلوب الرد" : "صندوق الوارد"}
        sub={isCompany ? "المستخلصات المرتجعة لكم والمسودات" : "المستخلصات اللي الدور عليك فيها دلوقتي"}
        crumbs={[{ label: "الرئيسية", href: "/" }, { label: isCompany ? "مطلوب الرد" : "صندوق الوارد" }]}
      />
      <Card>
        <CardHeader title="المستخلصات" sub={<span className="num">{rows.length}</span>} />
        {rows.length === 0 ? (
          <EmptyState icon={Inbox} title="مفيش حاجة مستنياك">
            <div className="text-[13px]">أول ما مستخلص يوصل لمحطتك هيظهر هنا.</div>
          </EmptyState>
        ) : (
          <InvoiceTable rows={rows} steps={steps} showCompany={!isCompany} />
        )}
      </Card>
    </>
  );
}
