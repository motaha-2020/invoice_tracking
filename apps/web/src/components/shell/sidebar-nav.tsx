"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { AllowedNavSection } from "@/features/shell/nav";
import { NAV_ICONS } from "./nav-icons";
import { closeMobileNav } from "./shell-controls";

type SidebarNavProps = { sections: AllowedNavSection[]; inboxCount: number };

/** أطول href بيطابق المسار الحالي هو اللي active (/invoices/new مش بيعلّم /invoices) */
function activeHref(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((h) => (h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(`${h}/`)))
    .sort((a, b) => b.length - a.length)[0];
}

export function SidebarNav({ sections, inboxCount }: SidebarNavProps) {
  const pathname = usePathname();
  const active = activeHref(
    pathname,
    sections.flatMap((s) => s.items.map((i) => i.href)),
  );

  return (
    <>
      {sections.map((sec) => (
        <div key={sec.title}>
          <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-tx4 nav:collapsed:hidden">{sec.title}</div>
          {sec.items.map((it) => {
            const Icon = NAV_ICONS[it.icon];
            const on = it.href === active;
            const count = it.showInboxCount ? inboxCount : 0;
            return (
              <Link
                key={it.key}
                href={it.href}
                title={it.label}
                aria-current={on ? "page" : undefined}
                onClick={closeMobileNav}
                className={cn(
                  "mb-0.5 flex items-center gap-2.5 whitespace-nowrap rounded-base border-s-3 border-transparent px-3 py-2 font-medium no-underline",
                  "nav:collapsed:justify-center nav:collapsed:px-0 nav:collapsed:py-[9px]",
                  on ? "border-brand bg-sel font-semibold text-brand-tx" : "text-tx2 hover:bg-hover hover:text-tx",
                )}
              >
                <Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="nav:collapsed:hidden">{it.label}</span>
                {count > 0 && (
                  <span className="num ms-auto rounded-sm bg-cr1 px-[7px] text-[11px] font-bold text-cr7 nav:collapsed:hidden">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}
