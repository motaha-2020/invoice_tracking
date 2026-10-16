"use client";

import { Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Card, CardBody, CardHeader, Field, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { ALLOWED_ACCEPT_CLIENT } from "../attachments.types";
import { replaceReturnedContentAction } from "../draft.actions";
import type { DraftAttachment } from "../draft.types";
import { useAttachments } from "./use-attachments";
import { ExcelUpload } from "./wizard/excel-upload";
import { FileRow } from "./wizard/step-files";

type Props = {
  invoiceId: string;
  attachments: DraftAttachment[];
  docTypes: { id: string; name: string }[];
  missingDocs: { id: string; name: string }[];
};

/**
 * المقاول أثناء الاستيفاء: استبدال البنود / المهمات من Excel، وإضافة أو حذف مرفقات.
 * أول تعديل بيفتح نسخة جديدة من المستخلص، والنسخة المقدمة سابقاً بتفضل في السجل.
 */
export function CompanyUpdatePanel({ invoiceId, attachments, docTypes, missingDocs }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [files, setFiles] = useState(attachments);
  const [docType, setDocType] = useState(missingDocs[0]?.id ?? docTypes[0]?.id ?? "");
  const [pending, start] = useTransition();
  const att = useAttachments(invoiceId, (fn) => {
    setFiles(fn);
    router.refresh();
  });

  const replace = (input: { lines?: unknown; materials?: unknown }) =>
    start(async () => {
      const r = await replaceReturnedContentAction(invoiceId, input);
      toast.show(r.message ?? "", r.ok ? "ok" : "err");
    });

  return (
    <Card className="mb-4" accent="a">
      <CardHeader title="تحديث المستخلص أثناء الاستيفاء" sub="تُحفظ التعديلات في نسخة جديدة من المستخلص، ثم استخدم «إعادة التقديم»" />
      <CardBody className="flex flex-col gap-4">
        {missingDocs.length > 0 && <Alert tone="a">مستندات إلزامية غير مرفقة: {missingDocs.map((d) => d.name).join("، ")}</Alert>}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <b className="text-[13px]">استبدال بنود الأعمال (اختياري)</b>
            <ExcelUpload kind="lines" onRows={(r) => replace({ lines: r.lines })} />
            <b className="mt-2 text-[13px]">استبدال المهمات (اختياري)</b>
            <ExcelUpload kind="materials" onRows={(r) => replace({ materials: r.materials })} />
            {pending && <div className="text-xs text-tx3">جارٍ الحفظ…</div>}
          </div>
          <div className="flex flex-col gap-2">
            <b className="text-[13px]">المرفقات</b>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="نوع المستند" htmlFor="cu-dt" className="min-w-[220px] flex-1">
                <Select id="cu-dt" value={docType} onChange={(e) => setDocType(e.target.value)}>
                  {docTypes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
              <label className="inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-base border border-bd2 px-3 text-[13px] font-semibold hover:bg-hover">
                <Paperclip className="size-4" aria-hidden /> إرفاق ملف
                <input type="file" multiple accept={ALLOWED_ACCEPT_CLIENT} className="hidden" disabled={att.busy} onChange={(e) => att.upload(e.target.files, docType || null)} />
              </label>
            </div>
            {att.busy && <div className="text-xs text-tx3">جارٍ رفع الملفات…</div>}
            <div className="flex flex-col gap-1.5">
              {files.map((a) => (
                <div key={a.id}>
                  <div className="text-xs text-tx3">{docTypes.find((d) => d.id === a.docTypeId)?.name ?? "مرفق"}</div>
                  <FileRow a={a} onRemove={() => att.remove(a.id)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
