import Link from "next/link";
import { cn } from "@/lib/cn";

export type TabDef = { key: string; label: string; count?: number };

/**
 * تابات كلينكات (?tab=) — كل تاب صفحة server لوحدها، فالتنقل بيحمّل الداتا اللي محتاجها بس.
 */
export function TabLinks({ base, tabs, current }: { base: string; tabs: TabDef[]; current: string }) {
  return (
    <nav role="tablist" aria-label="أقسام الصفحة" className="mb-4 flex flex-wrap gap-1 border-b border-bd2">
      {tabs.map((t) => {
        const on = t.key === current;
        return (
          <Link
            key={t.key}
            role="tab"
            aria-selected={on}
            href={`${base}?tab=${t.key}`}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm font-semibold no-underline transition-colors",
              on ? "border-brand text-brand-tx" : "border-transparent text-tx2 hover:text-tx",
            )}
          >
            {t.label}
            {t.count != null && <span className="num rounded-full bg-sunken px-1.5 text-xs text-tx3">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
