"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type ToastKind = "info" | "ok" | "err";
type ToastItem = { id: number; message: string; kind: ToastKind };
type ToastApi = { show: (message: string, kind?: ToastKind) => void };

const ToastContext = createContext<ToastApi | null>(null);

const kindCls: Record<ToastKind, string> = { info: "bg-p950", ok: "bg-ok7", err: "bg-cr7" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++seq.current;
    setItems((xs) => [...xs, { id, message, kind }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 2800);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext value={api}>
      {children}
      <div aria-live="polite" className="fixed bottom-5 left-5 z-60 flex flex-col gap-2">
        {items.map((t) => {
          const Icon = t.kind === "err" ? AlertCircle : CheckCircle2;
          return (
            <div
              key={t.id}
              className={cn(
                "flex animate-[fade_.14s_var(--ease-we)] items-center gap-2 rounded-base px-4 py-2.5 text-[13px] text-white shadow-overlay",
                kindCls[t.kind],
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
}

/** const toast = useToast(); toast.show('تم الحفظ', 'ok') */
export function useToast(): ToastApi {
  const ctx = use(ToastContext);
  if (!ctx) throw new Error("useToast لازم يتنادى جوه <ToastProvider>");
  return ctx;
}
