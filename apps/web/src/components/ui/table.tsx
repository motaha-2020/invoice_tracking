import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** غلاف بيسكرول أفقي على الشاشات الصغيرة */
export function TableWrap({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("overflow-x-auto", className)} {...props} />;
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse", className)} {...props} />;
}

export function THead(props: ComponentProps<"thead">) {
  return <thead {...props} />;
}

export function TBody(props: ComponentProps<"tbody">) {
  return <tbody {...props} />;
}

type Align = { align?: "start" | "end" | "center" };
const alignCls = { start: "text-start", end: "text-end", center: "text-center" };

export function Th({ className, align = "start", ...props }: Omit<ComponentProps<"th">, "align"> & Align) {
  return (
    <th
      className={cn(
        "sticky top-0 whitespace-nowrap border-b border-bd2 bg-hover px-3 py-[9px] text-xs font-semibold text-tx2",
        alignCls[align],
        className,
      )}
      {...props}
    />
  );
}

type TrProps = ComponentProps<"tr"> & {
  /** شريط جانبي: متأخر (r) أو تحذير (a) */
  flag?: "r" | "a";
  selected?: boolean;
  interactive?: boolean;
};

export function Tr({ className, flag, selected, interactive, ...props }: TrProps) {
  return (
    <tr
      className={cn(
        interactive && "cursor-pointer [&:hover>td]:bg-hover",
        selected && "[&>td]:bg-sel",
        flag === "r" && "[&>td:first-child]:shadow-[inset_-3px_0_0_var(--cr6)]",
        flag === "a" && "[&>td:first-child]:shadow-[inset_-3px_0_0_var(--wa6)]",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, align = "start", ...props }: Omit<ComponentProps<"td">, "align"> & Align) {
  return <td className={cn("border-b border-bd1 px-3 py-2.5 align-middle", alignCls[align], className)} {...props} />;
}

export function TFoot({ className, ...props }: ComponentProps<"tfoot">) {
  return (
    <tfoot
      className={cn("[&_td]:border-b-0 [&_td]:bg-brand-soft [&_td]:font-bold [&_td]:text-brand-tx", className)}
      {...props}
    />
  );
}
