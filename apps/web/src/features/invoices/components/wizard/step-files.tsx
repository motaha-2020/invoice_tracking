"use client";

import { CheckCircle2, FileCheck2, OctagonAlert, Paperclip, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Field, Money, Num, Select } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { ALLOWED_ACCEPT_CLIENT, fileSizeLabel } from "../../attachments.types";
import type { DraftPreview } from "../../draft-preview";
import type { AoWorkspace, DraftAttachment, DraftState, WorkTypeOption } from "../../draft.types";
import { useAttachments } from "../use-attachments";
import { CategoryBox } from "./step-lines";

type Props = {
  d: DraftState;
  updateAttachments: (fn: (xs: DraftAttachment[]) => DraftAttachment[]) => void;
  ws: AoWorkspace;
  preview: DraftPreview;
  blockers: { step: number; text: string }[];
  goStep: (n: number) => void;
  workTypes: WorkTypeOption[];
};

export function FileRow({ a, onRemove }: { a: DraftAttachment; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-base border border-bd1 px-3 py-1.5">
      <FileCheck2 className="size-4 shrink-0 text-ok6" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[13px]" title={a.fileName}>{a.fileName}</span>
      <Num className="text-xs text-tx3">{fileSizeLabel(a.size)}</Num>
      {onRemove && <Button size="sm" variant="gh" icon aria-label={`حذف ${a.fileName}`} onClick={onRemove}><X /></Button>}
    </div>
  );
}

/** الخطوة 4: المستندات الإلزامية + المرفقات الإضافية + مراجعة قبل التقديم */
export function StepFiles({ d, updateAttachments, ws, preview, blockers, goStep, workTypes }: Props) {
  const files = useAttachments(d.draftId, updateAttachments);
  const [extraType, setExtraType] = useState(ws.docTypes[0]?.id ?? "");
  const reqIds = new Set(ws.requiredDocs.map((r) => r.id));
  const extra = d.attachments.filter((a) => !a.docTypeId || !reqIds.has(a.docTypeId));
  const t = preview.totals;
  const wt = workTypes.find((w) => w.id === d.workTypeId);
  const kv = (label: string, v: ReactNode) => <div><dt className="text-xs text-tx3">{label}</dt><dd className="m-0 mt-0.5 font-semibold">{v}</dd></div>;

  return (
    <div className="flex flex-col gap-4">
      {!d.draftId && <Alert tone="a">يرجى حفظ المسودة أولاً لتتمكن من رفع المرفقات.</Alert>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="المستندات الإلزامية" sub={ws.org.projectType} />
          <CardBody className="flex flex-col gap-4">
            {ws.requiredDocs.length === 0 && <div className="text-[13px] text-tx3">لا توجد مستندات إلزامية لنوع المشروع.</div>}
            {ws.requiredDocs.map((doc) => {
              const fs = d.attachments.filter((a) => a.docTypeId === doc.id);
              return (
                <div key={doc.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-[13px]">{doc.name} <span className="text-cr6">*</span></b>
                    {fs.length ? <Badge tone="g">مرفق</Badge> : <Badge tone="r">مطلوب</Badge>}
                  </div>
                  {fs.map((a) => <FileRow key={a.id} a={a} onRemove={() => files.remove(a.id)} />)}
                  <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-base border border-bd2 px-2.5 py-1 text-[13px] font-semibold hover:bg-hover">
                    <Paperclip className="size-4" aria-hidden /> {fs.length ? "إرفاق ملف آخر" : "اختيار ملف"}
                    <input type="file" multiple accept={ALLOWED_ACCEPT_CLIENT} className="hidden" disabled={!d.draftId || files.busy} onChange={(e) => files.upload(e.target.files, doc.id)} />
                  </label>
                </div>
              );
            })}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="مرفقات إضافية" sub="اختياري" />
          <CardBody className="flex flex-col gap-3">
            <Field label="نوع المستند" htmlFor="w-xdt">
              <Select id="w-xdt" value={extraType} onChange={(e) => setExtraType(e.target.value)}>
                {ws.docTypes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
            </Field>
            <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-base border border-bd2 px-2.5 py-1 text-[13px] font-semibold hover:bg-hover">
              <Paperclip className="size-4" aria-hidden /> اختيار ملف
              <input type="file" multiple accept={ALLOWED_ACCEPT_CLIENT} className="hidden" disabled={!d.draftId || files.busy} onChange={(e) => files.upload(e.target.files, extraType || null)} />
            </label>
            {files.busy && <div className="text-xs text-tx3">جارٍ رفع الملفات…</div>}
            {extra.length ? extra.map((a) => <FileRow key={a.id} a={a} onRemove={() => files.remove(a.id)} />) : <div className="text-[13px] text-tx3">لا توجد مرفقات إضافية.</div>}
            <div className="text-xs text-tx3">الحد الأقصى للملف 25 ميجابايت — PDF وصور وExcel وWord وZIP وDWG.</div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="مراجعة قبل التقديم" />
        <CardBody className="flex flex-col gap-4">
          <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-3">
            {kv("رقم المستخلص", <Num>{d.invoiceNo}</Num>)}
            {kv("اسم المسار", d.pathName)}
            {kv("نوع الأعمال", wt?.name ?? "—")}
            {kv("الفترة", d.period || "—")}
            {kv("العقد", <Num>{ws.ao.contractNo}</Num>)}
            {kv("أمر التكليف", <Num>{ws.ao.aoNo}</Num>)}
            {kv("المشروع", ws.org.project)}
            {kv("البنود", <><Num>{preview.lines.length}</Num> بند</>)}
            {kv("المهمات", <><Num>{preview.materials.length}</Num> صنف</>)}
            {kv("المرفقات", <><Num>{d.attachments.length}</Num> ملف</>)}
          </dl>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="text-[13px]">
              <Sum label="إجمالي قيمة الأعمال" v={t.gross} />
              {t.held.map((h) => <Sum key={h.type} label={`${h.name} (${h.pct}%)`} v={-h.amount} />)}
              <Sum label={`ضريبة القيمة المضافة (${t.vatPct}%)`} v={t.vat} />
              {t.deductions.map((x, i) => <Sum key={i} label={`${x.name}${x.pct != null ? ` (${x.pct}%)` : ""}`} v={-x.amount} />)}
              <div className="mt-1 flex justify-between border-t border-bd2 pt-2 text-[15px] font-bold"><span>صافي المستحق المتوقع</span><Money>{formatMoney(t.net)}</Money></div>
              <div className="mt-2 rounded-base bg-hover px-3 py-2 text-xs">فقط {t.words}</div>
              <div className="mt-1.5 text-xs text-tx3">الاستقطاعات قيم مبدئية من شروط التعاقد، وتؤكدها الإدارة المالية عند السداد.</div>
            </div>
            <CategoryBox preview={preview} />
          </div>
          {blockers.length ? (
            <Alert tone="r" title="يتعذّر التقديم قبل استكمال ما يلي:">
              <ul className="m-0 mt-1 list-disc ps-5">
                {blockers.map((b) => (
                  <li key={b.text}>
                    {b.step < 4 ? <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-start underline" onClick={() => goStep(b.step)}>{b.text}</button> : b.text}
                  </li>
                ))}
              </ul>
            </Alert>
          ) : (
            <Alert tone="g"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4" aria-hidden /> البيانات مكتملة — عند التقديم يُحال المستخلص إلى مرحلة مراجعة مشرف التنفيذ ويصل إليه إشعار وبريد إلكتروني.</span></Alert>
          )}
          {preview.lineCheck.warn > 0 && (
            <Alert tone="a"><span className="inline-flex items-center gap-1.5"><OctagonAlert className="size-4" aria-hidden /> توجد <Num>{preview.lineCheck.warn}</Num> تنبيهات في البنود — لا تمنع التقديم لكنها تظهر للمراجعين.</span></Alert>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Sum({ label, v }: { label: string; v: number }) {
  return (
    <div className={v < 0 ? "flex justify-between py-1 text-cr7" : "flex justify-between py-1"}>
      <span>{label}</span>
      <Money>{v < 0 ? `− ${formatMoney(-v)}` : formatMoney(v)}</Money>
    </div>
  );
}
