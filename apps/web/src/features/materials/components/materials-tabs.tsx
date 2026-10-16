import Link from "next/link";
import { Num } from "@/components/ui";
import { cn } from "@/lib/cn";

export type MaterialsTab = "catalog" | "issues" | "compare";

export const MATERIALS_TABS: { key: MaterialsTab; label: string }[] = [
  { key: "compare", label: "مقارنة أمر التكليف" },
  { key: "issues", label: "المنصرف" },
  { key: "catalog", label: "كتالوج المهمات" },
];

export function parseTab(v: unknown): MaterialsTab {
  return MATERIALS_TABS.some((t) => t.key === v) ? (v as MaterialsTab) : "compare";
}

/** تابات الصفحة — لينكات عادية (الحالة في الـ URL)، والفلاتر بتفضل زي ما هي */
export function MaterialsTabs({ active, query, counts }: { active: MaterialsTab; query: URLSearchParams; counts?: Partial<Record<MaterialsTab, number>> }) {
  return (
    <div role="tablist" aria-label="أقسام المهمات" className="flex flex-wrap gap-1 border-b border-bd1 px-[18px] max-sm:px-3">
      {MATERIALS_TABS.map((t) => {
        const qs = new URLSearchParams(query);
        qs.set("tab", t.key);
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            role="tab"
            aria-selected={on}
            href={`/materials?${qs.toString()}`}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold no-underline",
              on ? "border-brand text-brand-tx" : "border-transparent text-tx2 hover:text-tx",
            )}
          >
            {t.label}
            {counts?.[t.key] != null && <Num className="text-xs text-tx3">{counts[t.key]}</Num>}
          </Link>
        );
      })}
    </div>
  );
}
