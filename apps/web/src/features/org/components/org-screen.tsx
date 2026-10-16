import { Briefcase, Building, Building2, FileSpreadsheet, Landmark, RadioTower } from "lucide-react";
import { Alert, ButtonLink, Kpi, PageHeader } from "@/components/ui";
import { ImportPanel } from "@/features/imports/components/import-panel";
import { requireNavAccess } from "@/features/shell/nav.service";
import { companiesImporter } from "../companies.importer";
import { buildOrgOptions } from "../org.options";
import { orgImporter } from "../org.importer";
import { canEditOrg, getOrgPageData, type OrgPageData } from "../org.service";
import { projectsImporter } from "../projects.importer";
import type { OrgKind, OrgLevel } from "../org.kinds";
import { AddButton } from "./org-buttons";
import { OrgDialogsProvider } from "./org-dialogs";
import { CompaniesTable, TypesTable } from "./master-tables";
import { OrgTabs, parseOrgTab, type OrgTab } from "./org-tabs";
import { OrgTree } from "./org-tree";
import { ProjectsTable } from "./projects-table";

const ADD_FOR_TAB: Partial<Record<OrgTab, { kind: OrgKind; label: string }>> = {
  tree: { kind: "presidency", label: "رئاسة قطاعات" },
  projects: { kind: "project", label: "مشروع" },
  types: { kind: "projectType", label: "نوع مشروع" },
  companies: { kind: "company", label: "شركة" },
};

/** شاشة "الهيكل والمشاريع" — بتقرا الجلسة، فلازم تتعرض جوه <Suspense> */
export async function OrgScreen({ tabParam }: { tabParam: Promise<unknown> }) {
  const user = await requireNavAccess("org");
  const [data, canEdit, rawTab] = await Promise.all([getOrgPageData(user), canEditOrg(user), tabParam]);
  let tab = parseOrgTab(rawTab);
  if (tab === "import" && !canEdit) tab = "tree";
  const add = ADD_FOR_TAB[tab];
  const count = (k: OrgLevel) => data.nodes.filter((n) => n.kind === k).length;

  return (
    <OrgDialogsProvider canEdit={canEdit} options={buildOrgOptions(data.nodes, data.types)}>
      <PageHeader
        title="الهيكل والمشاريع"
        sub="الرئاسات والقطاعات والإدارات والسنترالات، والمشروعات والشركات"
        crumbs={[{ label: "الرئيسية", href: "/" }, { label: "الهيكل والمشاريع" }]}
        actions={
          canEdit ? (
            <>
              {tab !== "import" && (
                <ButtonLink href="/org?tab=import">
                  <FileSpreadsheet aria-hidden /> استيراد من Excel
                </ButtonLink>
              )}
              {add && <AddButton kind={add.kind} label={add.label} />}
            </>
          ) : undefined
        }
      />
      <Alert tone="p" className="mb-4">
        <b>المستخلصات بتورث مكانها في الهيكل</b> من أمر التكليف ← المشروع ← السنترال — فأي نقل لمشروع أو سنترال بيغيّر مين يشوف مستخلصاته.
      </Alert>
      <div className="mb-4 grid grid-cols-5 gap-4 max-xl:grid-cols-3 max-sm:grid-cols-2 max-sm:gap-3">
        <Kpi icon={Landmark} label="رئاسات القطاعات" value={count("presidency")} />
        <Kpi icon={Building2} label="القطاعات" value={count("sector")} sub={`${count("techUnit")} شئون فنية`} />
        <Kpi icon={Building} label="الإدارات العامة" value={count("generalDept")} />
        <Kpi icon={Briefcase} label="الإدارات المختصة" value={count("dept")} />
        <Kpi icon={RadioTower} label="السنترالات" value={count("central")} sub={`${data.projects.length} مشروع`} />
      </div>
      <OrgTabs
        current={tab}
        showImport={canEdit}
        counts={{ tree: count("central"), projects: data.projects.length, types: data.types.length, companies: data.companies.length }}
      />
      <TabBody tab={tab} data={data} canEdit={canEdit} />
    </OrgDialogsProvider>
  );
}

function TabBody({ tab, data, canEdit }: { tab: OrgTab; data: OrgPageData; canEdit: boolean }) {
  switch (tab) {
    case "projects":
      return <ProjectsTable projects={data.projects} types={data.types} />;
    case "types":
      return <TypesTable types={data.types} canEdit={canEdit} />;
    case "companies":
      return <CompaniesTable companies={data.companies} canEdit={canEdit} />;
    case "import":
      return <ImportSection />;
    default:
      return <OrgTree nodes={data.nodes} projects={data.projects} />;
  }
}

function ImportSection() {
  return (
    <div className="space-y-4">
      <Alert tone="i">
        ارفع بالترتيب: الهيكل الأول، بعده المشروعات (كل مشروع محتاج سنترال موجود)، والشركات في أي وقت. الكود فريد ومش بيتغير — لو موجود الاسم بس بيتحدث.
      </Alert>
      {[orgImporter, projectsImporter, companiesImporter].map((imp, i) => (
        <ImportPanel
          key={imp.templateId}
          templateId={imp.templateId}
          title={`${i + 1}. ${imp.title}`}
          templateFile={imp.templateFile}
          hint={HINTS[imp.templateId]}
        />
      ))}
    </div>
  );
}

const HINTS: Record<string, string> = {
  [orgImporter.templateId]: "رئاسات ← قطاعات ← إدارات عامة وشئون فنية ← إدارات مختصة ← سنترالات",
  [projectsImporter.templateId]: "أنواع المشروعات والمشروعات وربط كل مشروع بالسنترال",
  [companiesImporter.templateId]: "الشركات المنفذة وإيميل المستخلصات بتاع كل شركة",
};
