import type { CommitmentState } from "@it/domain";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

const bar = { g: "bg-ok6", a: "bg-wa6", r: "bg-cr6" };
const txt = { g: "text-ok7", a: "text-wa7", r: "text-cr7" };

/** شريط الالتزام المالي: المفوتر من الحد (الالتزام أو قيمة أمر التكليف) + التنبيه */
export function CommitmentMeter({ state, compact }: { state: CommitmentState; compact?: boolean }) {
  const w = Math.min(100, Math.max(0, state.pct));
  return (
    <div className={cn("min-w-[140px]", !compact && "space-y-1")} title={state.warning ?? undefined}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="num text-tx2">{formatMoney(state.billed, { decimals: 0 })}</span>
        <span className={cn("num font-semibold", txt[state.cls])}>{state.pct.toFixed(0)}%</span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(w)}
        aria-label="القيمة المفوترة من الارتباط المالي"
      >
        <div className={cn("h-full rounded-full", bar[state.cls])} style={{ width: `${w}%` }} />
      </div>
      {!compact && state.warning && <div className={cn("text-xs", txt[state.cls])}>{state.warning}</div>}
      {compact && state.warning && <div className={cn("mt-0.5 text-[11px] leading-tight", txt[state.cls])}>{state.level === "exceeded" ? "تجاوز الارتباط المالي" : "قارب على الحد"}</div>}
    </div>
  );
}
