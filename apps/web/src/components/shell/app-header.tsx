import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { describeRoles } from "@/features/auth/auth.service";
import { requireUser } from "@/features/auth/session";
import { getNotificationsSummary } from "@/features/notifications/notifications.service";
import { getAllowedNav } from "@/features/shell/nav.service";
import { CommandPalette, type PaletteItem } from "./command-palette";
import { NotificationsBell } from "./notifications-bell";
import { SidebarToggle, ThemeToggle } from "./shell-controls";
import { UserMenu } from "./user-menu";

/**
 * الهيدر: الجزء الثابت (اللوجو والعنوان) بيتعمله prerender،
 * والجزء اللي محتاج المستخدم (البحث، الإشعارات، القائمة) بيـ stream جوه Suspense.
 */
export function AppHeader() {
  return (
    <header
      data-print="hide"
      className="sticky top-0 z-30 flex h-[60px] items-center gap-3 bg-hdr px-4 text-white max-sm:gap-1.5 max-sm:px-2"
    >
      <SidebarToggle />
      <Link href="/" className="flex min-w-0 items-center gap-3 text-white no-underline">
        <Image
          src="/we-mark.png"
          alt="WE"
          width={34}
          height={34}
          priority
          className="size-[34px] rounded-full bg-white p-[3px] max-sm:hidden"
        />
        <div className="truncate text-base leading-tight font-bold max-sm:text-sm max-[380px]:hidden">
          منظومة تتبع المستخلصات
          <small className="block text-[11px] font-normal opacity-72 max-nav:hidden">المصرية للاتصالات · مكتب إدارة المشروعات (PMO)</small>
        </div>
      </Link>
      <div className="flex-1" />
      <Suspense fallback={<HeaderActionsFallback />}>
        <HeaderActions />
      </Suspense>
    </header>
  );
}

async function HeaderActions() {
  const user = await requireUser();
  const [nav, notifications, roles] = await Promise.all([
    getAllowedNav(user),
    getNotificationsSummary(user),
    describeRoles(user),
  ]);

  const seen = new Set<string>();
  const palette: PaletteItem[] = [];
  for (const it of nav.flatMap((s) => s.items)) {
    if (seen.has(it.href)) continue;
    seen.add(it.href);
    palette.push({ href: it.href, label: it.label, icon: it.icon });
  }

  return (
    <div className="flex items-center gap-3 max-sm:gap-1.5">
      <CommandPalette items={palette} />
      <ThemeToggle />
      <NotificationsBell unread={notifications.unread} items={notifications.items} />
      <UserMenu name={user.name} email={user.email} roles={roles} />
    </div>
  );
}

function HeaderActionsFallback() {
  return (
    <div className="flex items-center gap-3 max-sm:gap-1.5" aria-hidden>
      <div className="h-[34px] w-[260px] rounded-base bg-white/12 max-xl:w-9" />
      <ThemeToggle />
      <div className="h-[34px] w-9 rounded-base bg-white/12" />
      <div className="h-[34px] w-32 rounded-base bg-white/12 max-nav:w-9" />
    </div>
  );
}
