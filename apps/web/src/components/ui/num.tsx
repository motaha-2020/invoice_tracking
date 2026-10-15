import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** أي رقم جوه نص عربي: LTR + tabular عشان يتقري صح ويتصف في الجداول */
export function Num({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("num", className)} {...props} />;
}

/** فلوس: نفس Num بس bold */
export function Money({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("num font-semibold", className)} {...props} />;
}
