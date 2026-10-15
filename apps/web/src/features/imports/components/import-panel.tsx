"use client";

import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Num, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { commitImportAction, previewImportAction, type CommitState, type PreviewState } from "../import.actions";

type Props = {
  templateId: string;
  title: string;
  /** اسم ملف القالب في /templates */
  templateFile: string;
  /** شرح قصير يظهر تحت العنوان */
  hint?: string;
};

const STATUS: Record<string, { label: string; tone: "g" | "b" | "n" | "r" }> = {
  create: { label: "جديد", tone: "g" },
  update: { label: "تحديث", tone: "b" },
  skip: { label: "متجاهل", tone: "n" },
  error: { label: "خطأ", tone: "r" },
};

/**
 * لوحة الاستيراد الموحدة: تنزيل القالب ← رفع ← معاينة بكل صف ← تأكيد الحفظ.
 * مفيش أي حفظ قبل التأكيد. الصفوف اللي فيها أخطاء مش بتتحفظ.
 */
export function ImportPanel({ templateId, title, templateFile, hint }: Props) {
  const [prev, previewAction, previewing] = useActionState<PreviewState, FormData>(previewImportAction, { ok: false });
  const [done, commitAction, committing] = useActionState<CommitState, FormData>(commitImportAction, { ok: false });
  const [onlyProblems, setOnlyProblems] = useState(false);
  const p = prev.preview;
  const committed = done.ok && p;
  const rows = p ? (onlyProblems ? p.rows.filter((r) => r.errors.length || r.warnings.length) : p.rows) : [];

  return (
    <Card>
      <CardHeader
        title={title}
        sub={hint}
        actions={
          <a className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-tx" href={`/templates/${encodeURIComponent(templateFile)}`} download>
            <Download className="size-4" aria-hidden /> تنزيل القالب
          </a>
        }
      />
      <CardBody className="space-y-3">
        <form action={previewAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="templateId" value={templateId} />
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-base border border-dashed border-bd3 bg-hover px-3 py-2 text-sm text-tx2 hover:border-brand">
            <FileSpreadsheet className="size-4 shrink-0 text-brand-tx" aria-hidden />
            <input name="file" type="file" accept=".xlsx" required className="min-w-0 flex-1 text-sm" aria-label="ملف Excel" />
          </label>
          <Button variant="pr" type="submit" disabled={previewing}>
            <Upload aria-hidden /> {previewing ? "بيتفحص…" : "رفع ومعاينة"}
          </Button>
        </form>

        {!prev.ok && prev.message && <Alert tone="r">{prev.message}</Alert>}
        {done.message && <Alert tone={done.ok ? "g" : "r"}>{done.message}</Alert>}

        {p && !committed && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="g">جديد <Num>{p.counts.create}</Num></Badge>
              <Badge tone="b">تحديث <Num>{p.counts.update}</Num></Badge>
              <Badge tone="r">أخطاء <Num>{p.counts.error}</Num></Badge>
              <Badge tone="a">تحذيرات <Num>{p.counts.warnings}</Num></Badge>
              {p.counts.skip > 0 && <Badge tone="n">متجاهل <Num>{p.counts.skip}</Num></Badge>}
              <label className="ms-auto flex items-center gap-1.5 text-tx2">
                <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> الأخطاء والتحذيرات بس
              </label>
            </div>
            {p.notes.map((n) => <Alert key={n} tone="i">{n}</Alert>)}
            <TableWrap className="max-h-[420px] overflow-y-auto rounded-base border border-bd1">
              <Table>
                <THead>
                  <Tr><Th>الشيت</Th><Th align="end">الصف</Th><Th>البيان</Th><Th>الحالة</Th><Th>الملاحظات</Th></Tr>
                </THead>
                <TBody>
                  {rows.slice(0, 1000).map((r) => (
                    <Tr key={`${r.sheet}-${r.row}`} className={r.status === "error" ? "bg-cr1/40" : undefined}>
                      <Td className="text-xs text-tx3">{r.sheet}</Td>
                      <Td align="end"><Num>{r.row}</Num></Td>
                      <Td className="max-w-[360px] truncate" title={r.label}>{r.label}</Td>
                      <Td><Badge tone={STATUS[r.status]!.tone}>{STATUS[r.status]!.label}</Badge></Td>
                      <Td className="text-xs">
                        {r.errors.map((m) => <div key={m} className="text-cr7">{m}</div>)}
                        {r.warnings.map((m) => <div key={m} className="text-wa7">{m}</div>)}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
            <form action={commitAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="batchId" value={p.batchId} />
              <Button variant="ok" type="submit" disabled={committing || p.counts.create + p.counts.update === 0}>
                {committing ? "بيتحفظ…" : `تأكيد حفظ ${p.counts.create + p.counts.update} صف`}
              </Button>
              {p.counts.error > 0 && <span className="text-sm text-tx3">الصفوف اللي فيها أخطاء مش هتتحفظ — صلّحها في الملف وارفعه تاني.</span>}
            </form>
          </>
        )}
      </CardBody>
    </Card>
  );
}
