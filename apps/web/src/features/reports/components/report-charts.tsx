import type { ReactNode } from "react";
import { Num } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * شريط أفقي واحد (حجم): لون واحد من الهوية، طرف مدوّر عند نهاية القيمة، والرقم جنبه بلون النص.
 * tone="late" للتأخير (لون الحالة الحرجة) — دايماً معاه الرقم والنص، مش اللون لوحده.
 */
export function Bar({ value, max, label, tone, title }: { value: number; max: number; label?: ReactNode; tone?: "late"; title?: string }) {
  const w = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0;
  return (
    <div className="flex min-w-[140px] items-center gap-2" title={title}>
      <div className="h-2 flex-1 rounded-e-full bg-sunken" aria-hidden>
        <div className={cn("h-full rounded-e-full", tone === "late" ? "bg-cr6" : "bg-brand")} style={{ width: `${w}%` }} />
      </div>
      <span className="min-w-[2.5rem] text-end text-xs text-tx2">{label ?? <Num>{value}</Num>}</span>
    </div>
  );
}

/** بطاقة مؤشر: الرقم + المعنى + المعادلة (اختصار) */
export function KpiTile({ label, value, unit, hint, tone }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; tone?: "g" | "a" | "r" }) {
  return (
    <div className="rounded-md border border-bd1 bg-card px-[18px] py-4 shadow-card">
      <div className="text-[13px] font-medium text-tx2">{label}</div>
      <div className={cn("mt-1.5 text-[26px] font-bold leading-tight", tone === "g" && "text-ok6", tone === "a" && "text-wa6", tone === "r" && "text-cr6")}>
        <Num>{value}</Num>
        {unit && <span className="ms-1 text-sm font-semibold text-tx2">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-tx3">{hint}</div>}
    </div>
  );
}
