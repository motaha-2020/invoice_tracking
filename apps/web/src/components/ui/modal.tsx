"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
};

/**
 * Modal على <dialog> الأصلي: focus trap و Esc والـ backdrop من المتصفح نفسه.
 */
export function Modal({ open, onClose, title, children, footer, size = "md" }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // ضغطة على الـ backdrop (برّه الصندوق) بتقفل
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-auto max-h-[90vh] w-[min(560px,calc(100%-32px))] flex-col rounded-lg border-0 bg-card p-0 text-tx shadow-overlay open:flex",
        "open:animate-[fade_.14s_var(--ease-we)]",
        size === "lg" && "w-[min(860px,calc(100%-32px))]",
      )}
    >
      <div className="flex items-center gap-2 border-b border-bd1 px-5 py-4">
        <h3 className="m-0 flex-1 text-[17px] font-semibold">{title}</h3>
        <Button variant="gh" size="sm" icon onClick={onClose} aria-label="إغلاق">
          <X />
        </Button>
      </div>
      <div className="flex flex-col gap-3.5 overflow-auto px-5 py-[18px]">{children}</div>
      {footer && <div className="flex gap-2 border-t border-bd1 px-5 py-3">{footer}</div>}
    </dialog>
  );
}
