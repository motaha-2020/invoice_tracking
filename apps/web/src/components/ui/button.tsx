import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "default" | "pr" | "ok" | "dg" | "wa" | "gh";
export type ButtonSize = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-base border font-semibold whitespace-nowrap no-underline cursor-pointer " +
  "transition-colors duration-150 ease-we disabled:opacity-45 disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  default: "border-bd2 bg-card text-tx hover:border-bd3 hover:bg-hover",
  pr: "border-brand bg-brand text-white hover:bg-brand-h hover:border-brand-h",
  ok: "border-ok6 bg-ok6 text-white hover:opacity-90",
  dg: "border-cr3 bg-card text-cr6 hover:bg-cr1",
  wa: "border-wa3 bg-card text-wa7 hover:bg-wa1",
  gh: "border-transparent bg-transparent text-tx hover:bg-hover",
};

const sizes: Record<ButtonSize, { text: string; icon: string }> = {
  md: { text: "h-[34px] px-3.5", icon: "h-[34px] w-[34px] p-0" },
  sm: { text: "h-7 px-2.5 text-[13px]", icon: "h-7 w-7 p-0" },
};

type StyleProps = { variant?: ButtonVariant; size?: ButtonSize; icon?: boolean };

export function buttonClasses({ variant = "default", size = "md", icon = false }: StyleProps = {}, className?: string) {
  return cn(base, variants[variant], icon ? sizes[size].icon : sizes[size].text, className);
}

type ButtonProps = ComponentProps<"button"> & StyleProps;

export function Button({ variant, size, icon, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, icon }, className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & StyleProps;

/** لينك شكله زرار */
export function ButtonLink({ variant, size, icon, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, icon }, className)} {...props} />;
}
