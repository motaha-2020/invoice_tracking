import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Num } from "./num";

type KpiProps = {
  icon: LucideIcon;
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "r" | "g" | "a";
  /** لو موجود الكارت كله بيبقى لينك */
  href?: string;
};

const valueTone = { r: "text-cr6", g: "text-ok6", a: "text-wa6" };

export function Kpi({ icon: Icon, label, value, sub, tone, href }: KpiProps) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-[13px] font-medium text-tx2">
        <span className="grid size-7 place-items-center rounded-base bg-brand-soft text-brand-tx">
          <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
        {label}
      </div>
      <div className={cn("mt-2 text-[28px] font-bold leading-tight", tone && valueTone[tone])}>
        <Num>{value}</Num>
      </div>
      {sub != null && <div className="mt-0.5 text-xs text-tx3">{sub}</div>}
    </>
  );
  const cls = "block rounded-md border border-bd1 bg-card px-[18px] py-4 text-tx no-underline shadow-card";
  if (href) {
    return (
      <Link
        href={href}
        className={cn(cls, "transition-shadow duration-150 ease-we hover:border-bd2 hover:shadow-raised")}
      >
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}
