import { Search } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Button, Card, CardHeader, Input, PageHeader, PageSkeleton } from "@/components/ui";
import { can } from "@/features/auth/permissions";
import { ImportPanel } from "@/features/imports/components/import-panel";
import { IssueFilters } from "@/features/materials/components/issue-filters";
import { CatalogTable, ComparisonTable, IssuesTable } from "@/features/materials/components/materials-tables";
import { MaterialsTabs, parseTab } from "@/features/materials/components/materials-tabs";
import { getCatalog, getComparison, getFilterOptions, getIssues } from "@/features/materials/materials.service";
import { requireNavAccess } from "@/features/shell/nav.service";

export const metadata: Metadata = { title: "المهمات المنصرفة" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default function MaterialsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MaterialsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MaterialsContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireNavAccess("materials");
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const filter = { contractId: one(sp.contract), aoId: one(sp.ao), materialId: one(sp.material) };
  const search = one(sp.q);
  const [canIssues, canHistory] = await Promise.all([can(user, "issues.import"), can(user, "invoice.override")]);

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries({ contract: filter.contractId, ao: filter.aoId, material: filter.materialId, q: search })) if (v) query.set(k, v);

  return (
    <>
      <PageHeader
        title="المهمات المنصرفة"
        sub="المخطط في أمر التكليف ↔ المنصرف من المخازن ↔ المنفذ والمفوتر في المستخلصات"
        crumbs={[{ label: "الرئيسية", href: "/" }, { label: "المهمات المنصرفة" }]}
      />
      <Card className="mb-5">
        <MaterialsTabs active={tab} query={query} />
        {tab === "catalog" ? <CatalogSection search={search} /> : <IssuesSection tab={tab} user={user} filter={filter} />}
      </Card>

      {canIssues && (
        <div className="mb-5 grid gap-5 lg:grid-cols-2">
          <ImportPanel templateId="07_كتالوج_المهمات" title="رفع كتالوج المهمات" templateFile="07_كتالوج_المهمات.xlsx" hint="أصناف المهمات (رقم الشطب) — الموجود بيتحدث" />
          <ImportPanel
            templateId="08_المنصرف_من_المخازن"
            title="رفع المنصرف من المخازن"
            templateFile="08_المنصرف_من_المخازن.xlsx"
            hint="كل إذن صرف في صف — نفس الإذن لنفس الصنف بيتحدث"
          />
        </div>
      )}

      {canHistory && (
        <section aria-labelledby="hist-title" className="mb-5">
          <h2 id="hist-title" className="mb-1 text-lg font-bold">ترحيل المستخلصات الحالية</h2>
          <p className="mt-0 mb-3 text-sm text-tx2">
            مرة واحدة عند التشغيل: المستخلصات اللي في ملفات الموقف بتتسجل &quot;مرحّلة&quot; من غير بنود، بمحطتها الحالية وتاريخها. الرفع تاني بيحدّث الحالة بس.
          </p>
          <ImportPanel
            templateId="11_المستخلصات_السابقة"
            title="رفع المستخلصات السابقة"
            templateFile="11_المستخلصات_السابقة.xlsx"
            hint="لو أمر التكليف مش متسجل والمستخلص معلّق، هيتعمل أمر تكليف بانتظار الاعتماد"
          />
        </section>
      )}
    </>
  );
}

async function CatalogSection({ search }: { search?: string }) {
  const [rows, total] = await getCatalog(search);
  return (
    <>
      <form method="get" action="/materials" role="search" className="flex flex-wrap items-center gap-2 border-b border-bd1 px-[18px] py-2.5 max-sm:px-3">
        <input type="hidden" name="tab" value="catalog" />
        <Input name="q" type="search" defaultValue={search ?? ""} placeholder="ابحث برقم الشطب أو الوصف أو المجموعة" aria-label="بحث في الكتالوج" className="min-w-0 flex-1" />
        <Button type="submit" size="sm">
          <Search aria-hidden /> بحث
        </Button>
      </form>
      <CardHeader title="كتالوج المهمات" sub={<span className="num">{total}</span>} />
      <CatalogTable rows={rows} total={total} />
    </>
  );
}

type User = Awaited<ReturnType<typeof requireNavAccess>>;
type Filter = { contractId?: string; aoId?: string; materialId?: string };

async function IssuesSection({ tab, user, filter }: { tab: "issues" | "compare"; user: User; filter: Filter }) {
  const opts = await getFilterOptions(user);
  return (
    <>
      <IssueFilters tab={tab} contracts={opts.contracts} aos={opts.aos} materials={opts.materials} value={filter} />
      {tab === "issues" ? <IssuesBody user={user} filter={filter} /> : <ComparisonBody user={user} filter={filter} />}
    </>
  );
}

async function IssuesBody({ user, filter }: { user: User; filter: Filter }) {
  const { rows, total } = await getIssues(user, filter);
  return (
    <>
      <CardHeader title="أذون الصرف" sub={<span className="num">{total}</span>} />
      <IssuesTable rows={rows} total={total} />
    </>
  );
}

async function ComparisonBody({ user, filter }: { user: User; filter: Filter }) {
  const { rows, truncated } = await getComparison(user, filter);
  const red = rows.filter((r) => r.flags.some((f) => f.cls === "r")).length;
  const amber = rows.filter((r) => r.flags.length && !r.flags.some((f) => f.cls === "r")).length;
  return (
    <>
      <CardHeader
        title="مقارنة أمر التكليف"
        sub={
          <span>
            <span className="num">{rows.length}</span> صنف · <span className="num text-cr6">{red}</span> مشكلة · <span className="num text-wa6">{amber}</span> تحذير
          </span>
        }
      />
      <ComparisonTable rows={rows} truncated={truncated} />
    </>
  );
}
