import { Bell, BellOff, FileText } from "lucide-react";
import Link from "next/link";
import { markAllReadAction } from "@/features/notifications/notifications.actions";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { popoverPanel } from "./popover";

type Item = { id: string; title: string; invoiceId: string | null; readAt: Date | null; createdAt: Date };

/** جرس الإشعارات — popover أصلي من المتصفح (light dismiss من غير JS) */
export function NotificationsBell({ unread, items }: { unread: number; items: Item[] }) {
  return (
    <>
      <button
        type="button"
        popoverTarget="notif-pop"
        aria-label={unread ? `التنبيهات (${unread} جديد)` : "التنبيهات"}
        className="relative grid h-[34px] w-9 cursor-pointer place-items-center rounded-base border-0 bg-white/12 text-white hover:bg-white/20 max-sm:w-8"
      >
        <Bell className="size-4" strokeWidth={1.75} aria-hidden />
        {unread > 0 && (
          <span className="num absolute top-1 left-1 grid h-4 min-w-4 place-items-center rounded-lg bg-cr6 px-[3px] text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      <div id="notif-pop" popover="auto" className={popoverPanel("w-[380px]")}>
        <div className="flex items-center gap-2 border-b border-bd1 px-3.5 py-3 font-semibold">
          <Bell className="size-4" strokeWidth={1.75} aria-hidden />
          التنبيهات
          {unread > 0 && (
            <form action={markAllReadAction} className="ms-auto">
              <button type="submit" className="h-7 cursor-pointer rounded-base border-0 bg-transparent px-2.5 text-[13px] font-semibold text-tx hover:bg-hover">
                تمييز الكل كمقروء
              </button>
            </form>
          )}
        </div>
        {items.length === 0 ? (
          <div className="px-5 py-8 text-center text-tx3">
            <BellOff className="mx-auto mb-2 size-6" aria-hidden />
            لا توجد تنبيهات
          </div>
        ) : (
          items.map((n) => (
            <Link
              key={n.id}
              href="/invoices"
              className={cn(
                "flex gap-2.5 border-b border-bd1 px-3.5 py-2.5 text-[13px] text-tx no-underline hover:bg-hover",
                !n.readAt && "bg-brand-soft",
              )}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sunken text-tx2">
                <FileText className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
              <span>
                {n.title}
                <small className="num block text-[11px] text-tx3">{formatDate(n.createdAt)}</small>
              </span>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
