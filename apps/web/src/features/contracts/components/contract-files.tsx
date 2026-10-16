"use client";

import { Download, FileText, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Alert, Button, Card, CardHeader, EmptyState, Input, Num, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { ALLOWED_ACCEPT_CLIENT, fileSizeLabel } from "@/features/invoices/attachments.types";
import { formatDateTime } from "@/lib/format";
import type { ContractFile } from "../contract-edit.service";
import { docKinds } from "../contracts.labels";

/** مرفقات العقد أو أمر التكليف (aoId): الكل يقدر ينزّل، والرفع والحذف للشئون الفنية ومدير النظام */
export function ContractFiles({ contractId, aoId, files, canEdit }: { contractId: string; aoId?: string; files: ContractFile[]; canEdit: boolean }) {
  const kinds = docKinds(!!aoId);
  const toast = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const upload = (list: FileList | null) => {
    const picked = [...(list ?? [])];
    if (!picked.length) return;
    if (!kind) return setError("يرجى اختيار نوع المستند أولاً");
    start(async () => {
      for (const file of picked) {
        const body = new FormData();
        body.set("file", file);
        body.set("kind", kind);
        body.set("note", note);
        if (aoId) body.set("aoId", aoId);
        const res = await fetch(`/api/contracts/${contractId}/files`, { method: "POST", body });
        const json = (await res.json().catch(() => ({ ok: false, message: "تعذّر رفع الملف" }))) as { ok: boolean; message?: string };
        if (!json.ok) {
          setError(`${file.name}: ${json.message ?? "تعذّر رفع الملف"}`);
          router.refresh();
          return;
        }
      }
      setError(undefined);
      setNote("");
      if (input.current) input.current.value = "";
      toast.show(picked.length > 1 ? `تم رفع ${picked.length} ملفات` : "تم رفع الملف", "ok");
      router.refresh();
    });
  };

  const remove = (f: ContractFile) => {
    if (!confirm(`حذف الملف «${f.fileName}»؟`)) return;
    start(async () => {
      const res = await fetch(`/api/contract-files/${f.id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; message?: string };
      if (!json.ok) return setError(json.message ?? "تعذّر حذف الملف");
      setError(undefined);
      toast.show("تم حذف الملف", "ok");
      router.refresh();
    });
  };

  return (
    <Card className="mt-5">
      <CardHeader
        title={aoId ? "مرفقات أمر التكليف" : "مرفقات العقد"}
        sub={<>{aoId ? "خطاب أمر التكليف والملاحق والحصر وكشوف المهمات" : "برقية القبول والمقايسة والمستندات الخاصة بالعقد"} · <Num>{files.length}</Num></>}
      />
      {canEdit && (
        <div className="grid grid-cols-[220px_minmax(0,1fr)_auto] items-center gap-2 border-b border-bd1 px-[18px] py-3 max-md:grid-cols-1 max-sm:px-3">
          <Select aria-label="نوع المستند" value={kind} onChange={(e) => { setKind(e.target.value); setError(undefined); }}>
            <option value="">— نوع المستند —</option>
            {Object.entries(kinds).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
          <Input aria-label="ملاحظة" placeholder={aoId ? "ملاحظة (اختياري) — مثل: رقم الخطاب أو الموقع" : "ملاحظة (اختياري) — مثل: رقم البرقية"} value={note} onChange={(e) => setNote(e.target.value)} />
          <input ref={input} type="file" multiple hidden accept={ALLOWED_ACCEPT_CLIENT} aria-label={aoId ? "ملفات أمر التكليف" : "ملفات العقد"} onChange={(e) => upload(e.target.files)} />
          <Button variant="pr" disabled={pending} onClick={() => (kind ? input.current?.click() : setError("يرجى اختيار نوع المستند أولاً"))}>
            <Upload aria-hidden /> {pending ? "جارٍ الرفع…" : "رفع ملفات"}
          </Button>
          <span className="col-span-full text-xs text-tx3">اختر نوع المستند ثم ارفع ملفاً أو أكثر — PDF أو صور أو Excel أو Word، حتى 25 ميجابايت للملف</span>
        </div>
      )}
      {error && <Alert tone="r" className="mx-[18px] mt-3">{error}</Alert>}
      {files.length === 0 ? (
        <EmptyState icon={FileText} title={aoId ? "لا توجد مرفقات لأمر التكليف بعد" : "لا توجد مرفقات للعقد بعد"} />
      ) : (
        <ul className="m-0 list-none p-0">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 border-b border-bd1 px-[18px] py-2.5 last:border-b-0 max-sm:px-3">
              <FileText className="size-5 shrink-0 text-brand" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-tx">{f.kindLabel}</span>
                  <a href={`/api/contract-files/${f.id}`} className="truncate font-semibold" dir="auto">{f.fileName}</a>
                </div>
                <div className="mt-0.5 text-xs text-tx3">
                  {f.note && <>{f.note} · </>}<Num>{fileSizeLabel(f.size)}</Num> · <Num>{formatDateTime(f.uploadedAt)}</Num>{f.uploadedBy && <> · {f.uploadedBy}</>}
                </div>
              </div>
              <a href={`/api/contract-files/${f.id}`} className="inline-flex items-center gap-1 text-[13px]" aria-label={`تنزيل ${f.fileName}`}><Download className="size-4" aria-hidden /> تنزيل</a>
              {canEdit && (
                <Button size="sm" variant="gh" disabled={pending} onClick={() => remove(f)} aria-label={`حذف ${f.fileName}`}><Trash2 aria-hidden /></Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
