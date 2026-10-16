import { Banknote, Check, Undo2 } from "lucide-react";
import type { InvoiceStatus } from "@it/db";
import type { SlaState } from "@it/domain";
import { Num } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { PathStepView } from "../invoice-view.service";

type Props = {
  path: PathStepView[];
  status: InvoiceStatus;
  currentStep: string | null;
  returnTo: string | null;
  returnedFrom: string | null;
  heldAt: string | null;
  daysByStep: Record<string, number>;
  sla: SlaState;
  submittedAt: Date | null;
  tentative: boolean;
};

type Cell = { key: string; short: string; name: string; sla: number | null };

/** شريط المسار: تقديم المقاول ← مراحل الفئة ← السداد */
export function InvoiceStepper(p: Props) {
  const steps: Cell[] = [
    { key: "company", short: "تقديم المقاول", name: "تقديم المستخلص من المقاول", sla: null },
    ...p.path,
    { key: "done", short: "السداد", name: "تم السداد", sla: null },
  ];
  const idx = (k: string | null) => {
    const i = steps.findIndex((s) => s.key === k);
    return i < 0 ? 1 : i;
  };
  let cur = -1;
  let ret = -1;
  let from = -1;
  if (p.status === "draft") cur = 0;
  else if (p.status === "paid") cur = steps.length;
  else if (p.status === "returned") {
    from = idx(p.returnedFrom);
    ret = p.returnTo === "company" ? 0 : idx(p.returnTo);
  } else cur = idx(p.status === "on_hold" ? (p.heldAt ?? p.currentStep) : p.currentStep);

  return (
    <ol aria-label="مسار المستخلص" className="m-0 flex list-none gap-0 overflow-x-auto p-0 pb-1">
      {steps.map((s, i) => {
        const isRet = i === ret;
        const isFrom = i === from;
        const done = p.status === "paid" || (p.status === "returned" ? i < from && !isRet : i < cur);
        const isCur = !done && (i === cur || isFrom);
        let detail = "";
        let tone = "";
        let icon = <Num>{i}</Num>;
        if (isRet) {
          tone = "ret";
          icon = <Undo2 className="size-3.5" aria-hidden />;
          detail = `معاد هنا · ${p.sla.elapsed ?? 0} يوم`;
        } else if (done) {
          tone = "done";
          icon = s.key === "done" ? <Banknote className="size-3.5" aria-hidden /> : <Check className="size-3.5" aria-hidden />;
          detail =
            s.key === "company" ? (p.submittedAt ? formatDate(p.submittedAt) : "")
            : p.daysByStep[s.key] != null ? `${p.daysByStep[s.key]} يوم${s.sla != null ? ` من ${s.sla}` : ""}`
            : "";
        } else if (isFrom) {
          tone = "cur";
          detail = "يعود إليها بعد الاستيفاء";
        } else if (isCur) {
          tone = `cur-${p.sla.cls}`;
          detail =
            p.status === "on_hold" ? `موقوف · ${p.sla.elapsed ?? 0} يوم`
            : p.status === "draft" ? "مسودة"
            : p.sla.sla != null ? `${p.sla.elapsed}/${p.sla.sla} يوم`
            : `${p.sla.elapsed ?? 0} يوم`;
        } else if (s.key !== "done" && s.key !== "company") {
          detail = `${s.sla != null ? `المدة ${s.sla} يوم` : "دون مدة مستهدفة"}${p.tentative ? " · مبدئي" : ""}`;
        }
        return (
          <li
            key={s.key}
            title={s.name}
            aria-current={isCur || isRet ? "step" : undefined}
            className="relative flex min-w-[104px] flex-1 flex-col items-center px-1 text-center"
          >
            {i > 0 && (
              <span aria-hidden className={cn("absolute top-[14px] -start-1/2 end-1/2 h-0.5", done || isCur || isRet ? "bg-ok6" : "bg-bd2")} />
            )}
            <span
              className={cn(
                "relative z-1 grid size-7 place-items-center rounded-full border-2 text-xs font-bold",
                tone === "done" && "border-ok6 bg-ok6 text-white",
                tone === "ret" && "border-in6 bg-in1 text-in7",
                tone === "cur" && "border-brand bg-brand-soft text-brand-tx",
                tone === "cur-g" && "border-ok6 bg-ok1 text-ok7",
                tone === "cur-a" && "border-wa6 bg-wa1 text-wa7",
                tone === "cur-r" && "border-cr6 bg-cr1 text-cr7",
                (tone === "cur-n" || tone === "cur-b") && "border-brand bg-brand-soft text-brand-tx",
                !tone && "border-bd2 bg-card text-tx3",
              )}
            >
              {icon}
            </span>
            <span className={cn("mt-1.5 text-xs font-semibold leading-snug", isCur || isRet ? "text-tx" : "text-tx2")}>{s.short}</span>
            {detail && <span className="text-[11px] text-tx3">{detail}</span>}
          </li>
        );
      })}
    </ol>
  );
}
