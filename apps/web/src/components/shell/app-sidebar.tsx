import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/features/auth/session";
import { countInbox } from "@/features/invoices/invoices.service";
import { getAllowedNav } from "@/features/shell/nav.service";
import { SidebarNav } from "./sidebar-nav";

/**
 * القائمة الجانبية: على الديسكتوب sticky وبتتقفل لـ 64px، وعلى الموبايل (≤860px) drawer من اليمين.
 */
export function AppSidebar() {
  return (
    <aside
      id="app-sidebar"
      aria-label="القائمة الرئيسية"
      data-print="hide"
      className={[
        "w-[248px] shrink-0 overflow-auto border-e border-bd1 bg-side px-2.5 py-3 transition-[width,transform] duration-200 ease-we",
        "nav:sticky nav:top-[60px] nav:h-[calc(100vh-60px)] nav:collapsed:w-16",
        "max-nav:invisible max-nav:fixed max-nav:top-[60px] max-nav:right-0 max-nav:bottom-0 max-nav:z-35 max-nav:translate-x-full max-nav:shadow-overlay",
        "max-nav:navopen:visible max-nav:navopen:translate-x-0",
      ].join(" ")}
    >
      <Suspense fallback={<NavFallback />}>
        <SidebarItems />
      </Suspense>
    </aside>
  );
}

async function SidebarItems() {
  const user = await requireUser();
  const [sections, inboxCount] = await Promise.all([getAllowedNav(user), countInbox(user)]);
  return <SidebarNav sections={sections} inboxCount={inboxCount} />;
}

function NavFallback() {
  return (
    <div className="flex flex-col gap-2 px-1 pt-3" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-8" />
      ))}
    </div>
  );
}
