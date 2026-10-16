import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/ui";
import type { SessionUser } from "@/features/auth/auth.types";
import { ImportPanel } from "@/features/imports/components/import-panel";
import { requireNavAccess } from "@/features/shell/nav.service";
import { TabLinks } from "@/components/ui/tab-links";
import { HolidaysPanel } from "@/features/workflow/components/holidays-panel";
import { RequiredDocs } from "@/features/workflow/components/required-docs";
import { ReturnReasons } from "@/features/workflow/components/return-reasons";
import { SmtpForm } from "@/features/emails/components/smtp-form";
import { getSmtpView } from "@/features/emails/smtp.service";
import { SettingsForm } from "@/features/workflow/components/settings-form";
import { SlaMatrixEditor } from "@/features/workflow/components/sla-matrix";
import * as wf from "@/features/workflow/workflow.service";

export const metadata: Metadata = { title: "مسار الاعتماد والمدد المستهدفة" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TABS = [
  { key: "path", label: "مسار الاعتماد والمدد المستهدفة" },
  { key: "reasons", label: "أسباب الإعادة للاستيفاء" },
  { key: "docs", label: "المستندات الإلزامية" },
  { key: "holidays", label: "العطلات الرسمية" },
  { key: "settings", label: "الإعدادات" },
];

export default function WorkflowPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WorkflowContent searchParams={searchParams} />
    </Suspense>
  );
}

async function WorkflowContent({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireNavAccess("workflow");
  const raw = (await searchParams).tab;
  const t = Array.isArray(raw) ? raw[0] : raw;
  const tab = TABS.some((x) => x.key === t) ? t! : "path";

  return (
    <>
      <PageHeader
        title="مسار الاعتماد والمدد المستهدفة"
        sub="مسار الاعتماد لكل فئة تجاوز والمدة المستهدفة (SLA) لكل مرحلة بأيام العمل الرسمية، وأسباب الإعادة للاستيفاء والمستندات والعطلات الرسمية"
        crumbs={[{ label: "الرئيسية", href: "/" }, { label: "مسار الاعتماد والمدد المستهدفة" }]}
      />
      <TabLinks base="/workflow" tabs={TABS} current={tab} />
      <TabBody tab={tab} actor={actor} />
    </>
  );
}

async function TabBody({ tab, actor }: { tab: string; actor: SessionUser }) {
  switch (tab) {
    case "reasons":
      return <ReturnReasons reasons={await wf.getReturnReasons(actor)} />;
    case "docs": {
      const m = await wf.getDocsMatrix(actor);
      return <RequiredDocs docTypes={m.docTypes} projectTypes={m.projectTypes} required={m.required} />;
    }
    case "holidays": {
      const holidays = await wf.getHolidays(actor);
      return (
        <div className="space-y-4">
          <HolidaysPanel holidays={holidays} today={wf.todayCairo()} />
          <ImportPanel
            templateId="12_الأجازات_الرسمية"
            title="استيراد العطلات الرسمية من Excel"
            templateFile="12_الأجازات_الرسمية.xlsx"
            hint="كل يوم في صف مستقل — يُحدَّث اسم اليوم المسجل مسبقاً"
          />
        </div>
      );
    }
    case "settings": {
      const [values, smtp] = await Promise.all([wf.getSettingsView(actor), getSmtpView(actor)]);
      return (
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-4 max-xl:grid-cols-1">
          <SettingsForm values={values} />
          <SmtpForm view={smtp} />
        </div>
      );
    }
    default: {
      const cfg = await wf.getPathConfig(actor);
      return <SlaMatrixEditor steps={cfg.steps} categories={cfg.categories} />;
    }
  }
}
