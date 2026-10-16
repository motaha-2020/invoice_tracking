import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Badge, Card, CardHeader, EmptyState, Num, PageHeader, PageSkeleton } from "@/components/ui";
import { AoChangesTimeline, AoItemsTable, AoMaterialsCard, AoSitesCard } from "@/features/contracts/components/ao-sections";
import { CommitmentMeter } from "@/features/contracts/components/commitment-meter";
import { AO_STATUS } from "@/features/contracts/contracts.labels";
import { getAoView } from "@/features/contracts/contracts.service";
import { requireNavAccess } from "@/features/shell/nav.service";
import { formatCount, formatDate, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "أمر التكليف" };

type Params = Promise<{ id: string; aoId: string }>;

export default function AoPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AoContent params={params} />
    </Suspense>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-tx3">{label}</dt>
      <dd className="m-0 mt-0.5 font-semibold">{children}</dd>
    </div>
  );
}

async function AoContent({ params }: { params: Params }) {
  const user = await requireNavAccess("contracts");
  const { id, aoId } = await params;
  const view = await getAoView(user, id, aoId);
  if (!view) notFound();
  const { ao, commitment } = view;
  const st = AO_STATUS[ao.status];
  const over = view.items.filter((i) => i.over).length;

  return (
    <>
      <PageHeader
        title={<>أمر التكليف <span className="num">{ao.aoNo}</span></>}
        sub={ao.name}
        crumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "العقود وأوامر التكليف", href: "/contracts" },
          { label: ao.contract.contractNo, href: `/contracts/${ao.contract.id}` },
          { label: ao.aoNo },
        ]}
        actions={<Badge tone={st.tone} dot>{st.label}</Badge>}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card accent={commitment?.level === "exceeded" ? "r" : commitment?.level === "warn" ? "a" : undefined}>
          <CardHeader title="بيانات أمر التكليف" sub={ao.contract.company.name} />
          <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-x-5 gap-y-3.5 px-[18px] py-4 max-sm:px-3">
            <Field label="التاريخ"><Num>{formatDate(ao.aoDate)}</Num></Field>
            <Field label="المشروع">{ao.project ? `${ao.project.name}` : <span className="text-wa7">مش مربوط بمشروع</span>}</Field>
            <Field label="السنترال">{ao.project?.central.name ?? ao.centralText ?? "—"}</Field>
            <Field label="النطاق">{ao.area ?? "—"}{ao.outOfScope && <Badge tone="a" className="ms-1.5">خارج النطاق</Badge>}</Field>
            <Field label="القيمة الحالية"><Num>{formatMoney(ao.value, { decimals: 0 })}</Num></Field>
            <Field label="الالتزام المالي"><Num>{formatMoney(ao.financialCommitment, { decimals: 0 })}</Num></Field>
            <Field label="ملحق التخطيط"><Num>{formatMoney(ao.planningAnnexValue, { decimals: 0 })}</Num></Field>
            <Field label="قيمة الكميات المخططة"><Num>{formatMoney(view.plannedValue, { decimals: 0 })}</Num></Field>
            <Field label="خطاب الضمان النهائي"><Num>{ao.finalGuaranteePct == null ? "—" : `${Number(ao.finalGuaranteePct)}%`}</Num></Field>
            <Field label="الدمغات المسددة"><Num>{formatMoney(ao.stampsTotal, { decimals: 0 })}</Num></Field>
            <Field label="المستخلصات"><Num>{formatCount(ao._count.invoices)}</Num></Field>
            {ao.duration && <div className="col-span-full"><Field label="مدة التنفيذ"><span className="text-[13px] font-normal">{ao.duration}</span></Field></div>}
          </dl>
          {commitment && (
            <div className="border-t border-bd1 px-[18px] py-3.5 max-sm:px-3">
              <div className="mb-1.5 text-xs text-tx3">
                المفوتر من {commitment.partial ? "الالتزام المالي" : "قيمة أمر التكليف"} (<Num>{formatMoney(commitment.limit, { decimals: 0 })}</Num>) — المتبقي <Num>{formatMoney(commitment.remaining, { decimals: 0 })}</Num>
              </div>
              <CommitmentMeter state={commitment} />
            </div>
          )}
        </Card>
        <AoChangesTimeline changes={ao.changes} />
      </div>

      <div className="mt-5"><AoSitesCard sites={ao.sites} /></div>

      <Card className="mt-5">
        <CardHeader
          title="البنود المخططة"
          sub={<span className="num">{view.items.length}</span>}
          actions={over > 0 ? <Badge tone="r">{over} بند عدّى المخطط</Badge> : undefined}
        />
        {view.items.length === 0 ? <EmptyState icon={ListChecks} title="مفيش كميات مخططة لسه" /> : <AoItemsTable items={view.items} />}
      </Card>

      <div className="mt-5"><AoMaterialsCard materials={ao.materials} /></div>
    </>
  );
}
