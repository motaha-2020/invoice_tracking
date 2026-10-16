"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import type { DraftAttachment } from "../draft.types";

/** رفع / حذف مرفقات المستخلص عن طريق /api (multipart) */
export function useAttachments(invoiceId: string | null, onChange: (fn: (xs: DraftAttachment[]) => DraftAttachment[]) => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(0);

  const upload = async (files: FileList | File[] | null, docTypeId: string | null) => {
    if (!invoiceId || !files) return;
    for (const file of Array.from(files)) {
      setBusy((n) => n + 1);
      try {
        const fd = new FormData();
        fd.set("file", file);
        if (docTypeId) fd.set("docTypeId", docTypeId);
        const res = await fetch(`/api/invoices/${invoiceId}/attachments`, { method: "POST", body: fd });
        const body = (await res.json().catch(() => ({ ok: false, message: "تعذّر رفع الملف" }))) as { ok: boolean; message?: string; attachment?: DraftAttachment };
        if (!body.ok || !body.attachment) toast.show(body.message ?? `تعذّر رفع ${file.name}`, "err");
        else {
          onChange((xs) => [...xs, body.attachment!]);
          toast.show(`تم رفع ${file.name}`, "ok");
        }
      } catch {
        toast.show(`تعذّر رفع ${file.name} — يرجى التحقق من الاتصال`, "err");
      } finally {
        setBusy((n) => n - 1);
      }
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; message?: string };
    if (!body.ok) return toast.show(body.message ?? "تعذّر حذف الملف", "err");
    onChange((xs) => xs.filter((x) => x.id !== id));
  };

  return { upload, remove, busy: busy > 0 };
}
