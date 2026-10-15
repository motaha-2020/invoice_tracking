import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/labels";

export const toneClasses: Record<Tone, string> = {
  g: "bg-ok1 text-ok7",
  a: "bg-wa1 text-wa7",
  r: "bg-cr1 text-cr7",
  b: "bg-in1 text-in7",
  n: "bg-id1 text-tx2",
  p: "bg-brand-soft text-brand-tx",
};

type BadgeProps = ComponentProps<"span"> & { tone?: Tone; dot?: boolean };

export function Badge({ tone = "n", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-px text-xs font-semibold",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** شارة فئة التجاوز C1..C5 — مقترحة (منقّطة) أو معتمدة */
export function CategoryBadge({ code, suggested }: { code?: string | null; suggested?: string | null }) {
  if (code) {
    return (
      <span className="inline-block rounded-sm border border-p200 bg-brand-soft px-[7px] text-xs font-bold text-brand-tx">
        {code}
      </span>
    );
  }
  if (suggested) {
    return (
      <span
        title="فئة مقترحة"
        className="inline-block rounded-sm border border-dashed border-p200 bg-brand-soft px-[7px] text-xs font-bold text-brand-tx"
      >
        {suggested}؟
      </span>
    );
  }
  return <span className="inline-block rounded-sm border border-bd2 bg-bg px-[7px] text-xs text-tx3">—</span>;
}
