import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-base border border-bd2 bg-card text-tx transition-colors duration-150 ease-we hover:border-bd3 " +
  "focus:outline-2 focus:outline-offset-1 focus:outline-p500 read-only:bg-hover read-only:text-tx2 " +
  "aria-invalid:border-cr6 disabled:opacity-60";

type FieldProps = {
  label?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  /** رسالة (أو رسايل) الخطأ */
  error?: string | string[];
  className?: string;
  children: ReactNode;
};

/** label + control + hint/error */
export function Field({ label, htmlFor, required, hint, error, className, children }: FieldProps) {
  const err = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      {label != null && (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-tx2">
          {label}
          {required && <span className="text-cr6"> *</span>}
        </label>
      )}
      {children}
      {hint != null && !err && <div className="text-xs text-tx3">{hint}</div>}
      {err && (
        <div className="text-xs text-cr6" role="alert">
          {err}
        </div>
      )}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-[34px] px-2.5", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-[34px] px-2.5", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "resize-y px-2.5 py-2", className)} {...props} />;
}
