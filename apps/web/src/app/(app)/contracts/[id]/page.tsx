import { ClipboardList, FileStack, ListTree, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, CardHeader, EmptyState, Kpi, PageHeader, PageSkeleton } from "@/components/ui";
import { AoTable } from "@/features/contracts/components/ao-table";
import { BoqTable } from "@/features/contracts/components/boq-table";
import { ContractEditButton } from "@/features/contracts/components/contract-edit";
import { ContractFiles } from "@/features/contracts/components/contract-files";
import { getContractEditValues, listContractFiles } from "@/features/contracts/contract-edit.service";
import { TermsCard } from "@/features/contracts/components/terms-card";
import { getContractView } from "@/features/contracts/contracts.service";
import { requireNavAccess } from "@/features/shell/nav.service";
import { formatCount, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "العقد" };

type Params = Promise<{ id: string }>;

export default function ContractPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ContractContent params={params} />
    </Suspense>
  );
}

async function ContractContent({ params }: { params: Params }) {
  const user = await requireNavAccess("contracts");
  const { id } = await params;
  const view = await getContractView(user, id);
  if (!view) notFound();
  const { contract: c, stats } = view;
  const [editValues, files] = await Promise.all([getContractEditValues(user, c.id), listContractFiles(c.id)]);

  return (
    <>
      <PageHeader
        title={<>العقد <span className="num">{c.contractNo}</span></>}
        sub={`${c.company.name} — ${c.title}`}
        crumbs={[{ label: "الرئيسية", href: "/" }, { label: "العقود وأوامر التكليف", href: "/contracts" }, { label: c.contractNo }]}
      />
      <div className="mb-5 grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
        <Kpi icon={ListTree} label="بنود جدول الكميات" value={formatCount(stats.items)} sub={stats.unpriced ? `${stats.unpriced} بند غير مُسعّر · ${stats.groups} عنوان` : `${stats.groups} عنوان`} />
        <Kpi icon={ClipboardList} label="أوامر التكليف" value={formatCount(view.aos.length)} />
        <Kpi icon={FileStack} label="قيمة أوامر التكليف" value={formatMoney(stats.aoTotal, { decimals: 0 })} sub={c.contractValue != null ? `من قيمة العقد ${formatMoney(c.contractValue, { decimals: 0 })}` : undefined} />
        <Kpi icon={Wallet} label="القيمة المفوترة" value={formatMoney(stats.billed, { decimals: 0 })} sub="المستخلصات عدا المسودات" />
      </div>

      <TermsCard view={view} actions={editValues && <ContractEditButton contractId={c.id} values={editValues} />} />

      <ContractFiles contractId={c.id} files={files} canEdit={!!editValues} />

      <Card className="mt-5">
        <CardHeader title="أوامر التكليف" sub={<span className="num">{view.aos.length}</span>} />
        {view.aos.length === 0 ? (
          <EmptyState icon={ClipboardList} title="لا توجد أوامر تكليف على هذا العقد بعد" />
        ) : (
          <AoTable contractId={c.id} rows={view.aos} />
        )}
      </Card>

      <Card className="mt-5">
        <CardHeader title="جدول الكميات والأسعار (المقايسة)" sub={<span className="num">{view.boq.length}</span>} />
        {view.boq.length === 0 ? <EmptyState icon={ListTree} title="جدول الكميات لا يتضمن أي بنود" /> : <BoqTable rows={view.boq} />}
      </Card>
    </>
  );
}
