import { AlertTriangle, CheckCircle2, Info, OctagonAlert, Sparkles, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AlertTone = "a" | "r" | "i" | "g" | "p";

const tones: Record<AlertTone, { cls: string; icon: LucideIcon }> = {
  a: { cls: "border-wa6 bg-wa1 text-wa7", icon: AlertTriangle },
  r: { cls: "border-cr6 bg-cr1 text-cr7", icon: OctagonAlert },
  i: { cls: "border-in6 bg-in1 text-in7", icon: Info },
  g: { cls: "border-ok6 bg-ok1 text-ok7", icon: CheckCircle2 },
  p: { cls: "border-brand bg-brand-soft text-brand-tx", icon: Sparkles },
};

type AlertProps = { tone?: AlertTone; title?: ReactNode; children?: ReactNode; className?: string };

export function Alert({ tone = "a", title, children, className }: AlertProps) {
  const { cls, icon: Icon } = tones[tone];
  return (
    <div
      role={tone === "r" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-e-base border-s-3 px-3.5 py-2.5 text-[13px]", cls, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <div className="min-w-0">
        {title && <b className="block">{title}</b>}
        {children}
      </div>
    </div>
  );
}
