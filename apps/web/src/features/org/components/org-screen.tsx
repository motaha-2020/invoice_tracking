import { Briefcase, Building, Building2, FileSpreadsheet, Landmark, RadioTower } from "lucide-react";
import { Alert, ButtonLink, Kpi, PageHeader } from "@/components/ui";
import { ImportPanel } from "@/features/imports/components/import-panel";
import { requireNavAccess } from "@/features/shell/nav.service";
import { companiesImporter } from "../companies.importer";
import { buildOrgOptions } from "../org.options";
import { orgImporter } from "../org.importer";
import { canEditOrg, canManageOrg, getOrgPageData, type OrgPageData } from "../org.service";
import { projectsImporter } from "../projects.importer";
import type { OrgKind, OrgLevel } from "../org.kinds";
import { AddButton } from "./org-buttons";
import { OrgDialogsProvider } from "./org-dialogs";
import { CompaniesTable, TypesTable } from "./master-tables";
import { OrgTabs, parseOrgTab, type OrgTab } from "./org-tabs";
import { OrgTree } from "./org-tree";
import { ProjectsTable } from "./projects-table";
import { WorkTypesTable } from "./work-types-table";

const ADD_FOR_TAB: Partial<Record<OrgTab, { kind: OrgKind; label: string }>> = {
  tree: { kind: "presidency", label: "رئاسة قطاعات" },
  projects: { kind: "project", label: "مشروع" },
  types: { kind: "projectType", label: "نوع مشروع" },
  "work-types": { kind: "workType", label: "نوع أعمال" },
  companies: { kind: "company", label: "شركة منفذة" },
};

/** شاشة "الهيكل والمشاريع" — بتقرا الجلسة، فلازم تتعرض جوه <Suspense> */
export async function OrgScreen({ tabParam }: { tabParam: Promise<unknown> }) {
  const user = await requireNavAccess("org");
  const [data, canEdit, canManage, rawTab] = await Promise.all([getOrgPageData(user), canEditOrg(user), canManageOrg(user), tabParam]);
  let tab = parseOrgTab(rawTab);
  if (tab === "import" && !canEdit) tab = "tree";
  const add = ADD_FOR_TAB[tab];
  const count = (k: OrgLevel) => data.nodes.filter((n) => n.kind === k).length;

  return (
    <OrgDialogsProvider canEdit={canEdit} canManage={canManage} options={buildOrgOptions(data.nodes, data.types)}>
      <PageHeader
        title="الهيكل التنظيمي والمشروعات"
        sub="رئاسات القطاعات والقطاعات والإدارات والسنترالات، والمشروعات والشركات المنفذة"
        crumbs={[{ label: "الرئيسية", href: "/" }, { label: "الهيكل التنظيمي والمشروعات" }]}
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
        <b>يتحدد موقع المستخلص في الهيكل التنظيمي</b> من خلال أمر التكليف ← المشروع ← السنترال؛ لذا فإن نقل أي مشروع أو سنترال يغيّر نطاق الاطلاع على مستخلصاته.
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
        counts={{
          tree: count("central"),
          projects: data.projects.length,
          types: data.types.length,
          "work-types": data.workTypes.length,
          companies: data.companies.length,
        }}
      />
      <TabBody tab={tab} data={data} canManage={canManage} />
    </OrgDialogsProvider>
  );
}

function TabBody({ tab, data, canManage }: { tab: OrgTab; data: OrgPageData; canManage: boolean }) {
  switch (tab) {
    case "projects":
      return <ProjectsTable projects={data.projects} types={data.types} />;
    case "types":
      return <TypesTable types={data.types} canEdit={canManage} />;
    case "work-types":
      return <WorkTypesTable workTypes={data.workTypes} canEdit={canManage} />;
    case "companies":
      return <CompaniesTable companies={data.companies} canEdit={canManage} />;
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
        يرجى الاستيراد بالترتيب: الهيكل التنظيمي أولاً، ثم المشروعات (يتطلب كل مشروع سنترالاً مسجلاً)، والشركات المنفذة في أي وقت. الكود فريد ولا يتغير — وإذا كان مسجلاً يُحدَّث الاسم فقط.
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
  [projectsImporter.templateId]: "أنواع المشروعات وأنواع الأعمال والمشروعات وربط كل مشروع بالسنترال",
  [companiesImporter.templateId]: "الشركات المنفذة والبريد الإلكتروني للمستخلصات لكل شركة",
};
