"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { actAction } from "../flow.actions";

/** تنفيذ حركة على المستخلص من مودال: رسالة نجاح/خطأ، والمودال بيقفل لو نجحت */
export function useAct(invoiceId: string) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const run = (cmd: Record<string, unknown>, onDone?: () => void) =>
    start(async () => {
      const res = await actAction(invoiceId, cmd);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setError(undefined);
      toast.show(res.message ?? "تم الحفظ", "ok");
      onDone?.();
    });
  return { run, pending, error, setError };
}
