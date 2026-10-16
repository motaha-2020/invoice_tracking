import { Briefcase, FileSpreadsheet, FolderKanban, Hammer, Layers, Network, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export const ORG_TABS = ["tree", "projects", "types", "work-types", "companies", "import"] as const;
export type OrgTab = (typeof ORG_TABS)[number];

export function parseOrgTab(v: unknown): OrgTab {
  return typeof v === "string" && (ORG_TABS as readonly string[]).includes(v) ? (v as OrgTab) : "tree";
}

const TAB_INFO: Record<OrgTab, { label: string; icon: LucideIcon }> = {
  tree: { label: "الهيكل التنظيمي", icon: Network },
  projects: { label: "المشروعات", icon: FolderKanban },
  types: { label: "أنواع المشروعات", icon: Layers },
  "work-types": { label: "أنواع الأعمال", icon: Hammer },
  companies: { label: "الشركات المنفذة", icon: Briefcase },
  import: { label: "استيراد", icon: FileSpreadsheet },
};

/** تبويبات الشاشة — لينكات (?tab=) عشان الرابط يتبعت ويرجع لنفس التبويب */
export function OrgTabs({ current, counts, showImport }: { current: OrgTab; counts: Partial<Record<OrgTab, number>>; showImport: boolean }) {
  const tabs = ORG_TABS.filter((t) => t !== "import" || showImport);
  return (
    <nav aria-label="أقسام الشاشة" className="mb-4 flex gap-1 overflow-x-auto border-b border-bd2">
      {tabs.map((t) => {
        const { label, icon: Icon } = TAB_INFO[t];
        const on = t === current;
        return (
          <Link
            key={t}
            href={t === "tree" ? "/org" : `/org?tab=${t}`}
            aria-current={on ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium no-underline transition-colors duration-150 ease-we",
              on ? "border-brand text-brand-tx" : "border-transparent text-tx2 hover:text-tx",
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} aria-hidden />
            {label}
            {counts[t] != null && (
              <span className={cn("num rounded-full px-1.5 text-xs", on ? "bg-brand-soft2 text-brand-tx" : "bg-id1 text-tx3")}>{counts[t]}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
