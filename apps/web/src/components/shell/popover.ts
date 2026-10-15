import { cn } from "@/lib/cn";

/**
 * لوحة popover تحت الهيدر (يسار الشاشة في RTL زي الديمو).
 * ممنوع display classes على العنصر نفسه — المتصفح بيخفيه بـ display:none لما يكون مقفول.
 */
export function popoverPanel(width: string) {
  return cn(
    "fixed inset-auto top-14 left-4 m-0 max-h-[480px] overflow-auto rounded-md border border-bd1 bg-card p-0 text-tx shadow-overlay",
    "max-sm:right-2 max-sm:left-2 max-sm:w-auto",
    width,
  );
}
