import { cn } from "@/lib/cn";
import { Num } from "./num";

export type SlaTone = "g" | "a" | "r" | "n" | "b";

const tones: Record<SlaTone, string> = {
  g: "bg-ok1 text-ok7",
  a: "bg-wa1 text-wa7",
  r: "bg-cr1 text-cr7",
  n: "bg-id1 text-tx2",
  b: "bg-in1 text-in7",
};

type SlaChipProps = {
  tone: SlaTone;
  /** الوصف (في الميعاد، متأخر، مرتجع للشركة ...) */
  label: string;
  /** أيام العمل اللي عدّت في المحطة */
  elapsed?: number | null;
  /** الـ SLA بتاع المحطة بالأيام */
  sla?: number | null;
};

/**
 * شريحة الـ SLA. الحساب نفسه (أيام العمل، الحالة) في @it/domain — المكون ده عرض بس.
 */
export function SlaChip({ tone, label, elapsed, sla }: SlaChipProps) {
  const base = "inline-flex max-w-full items-center gap-1.5 rounded-sm px-2 py-px text-xs font-semibold";
  if (sla != null && elapsed != null) {
    const pct = Math.min(100, sla > 0 ? (elapsed / sla) * 100 : 100);
    return (
      <span className={cn(base, "whitespace-nowrap", tones[tone])} title={label}>
        <Num>
          {elapsed}/{sla}
        </Num>
        يوم
        <span aria-hidden className="relative h-1 w-[34px] overflow-hidden rounded-[2px] bg-current/25">
          <i className="absolute inset-y-0 start-0 rounded-[2px] bg-current" style={{ width: `${pct}%` }} />
        </span>
      </span>
    );
  }
  if (elapsed != null) {
    return (
      <span className={cn(base, tones[tone])}>
        {label} · <Num>{elapsed}</Num> يوم
      </span>
    );
  }
  return <span className={cn(base, tones[tone])}>{label}</span>;
}
