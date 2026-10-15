import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type CardProps = ComponentProps<"div"> & {
  /** شريط لون فوق الكارت (حالة) */
  accent?: "r" | "a" | "g";
  flat?: boolean;
};

const accents = { r: "border-t-3 border-t-cr6", a: "border-t-3 border-t-wa6", g: "border-t-3 border-t-ok6" };

export function Card({ accent, flat, className, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-md border border-bd1 bg-card", !flat && "shadow-card", accent && accents[accent], className)}
      {...props}
    />
  );
}

type CardHeaderProps = Omit<ComponentProps<"div">, "title"> & {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
};

export function CardHeader({ title, sub, actions, className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2.5 border-b border-bd1 px-[18px] py-3.5 max-sm:px-3", className)} {...props}>
      {title != null && <h3 className="m-0 text-base font-semibold">{title}</h3>}
      {sub != null && <span className="text-xs text-tx3">{sub}</span>}
      {children}
      {actions != null && <div className="ms-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-[18px] py-4 max-sm:px-3", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-b-md border-t border-bd1 bg-hover px-[18px] py-2 text-xs text-tx3", className)}
      {...props}
    />
  );
}
