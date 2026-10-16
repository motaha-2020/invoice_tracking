import { Check, Download, FileText, Paperclip, X } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, EmptyState, Num, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { fileSizeLabel } from "../attachments.types";
import type { InvoiceDetail, RevisionContent } from "../invoice.repo";

type Props = {
  revision: RevisionContent | null;
  revisions: InvoiceDetail["revisions"];
  requiredDocs: { id: string; name: string; have: boolean }[];
  projectType: string | null;
};

/** تاب المرفقات: المستندات الإلزامية + ملفات النسخة الحالية + نسخ المستخلص */
export function FilesTab({ revision, revisions, requiredDocs, projectType }: Props) {
  const missing = requiredDocs.filter((d) => !d.have).length;
  const files = revision?.attachments ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="المستندات الإلزامية"
            sub={projectType ?? undefined}
            actions={requiredDocs.length ? missing ? <Badge tone="r">ناقص <Num>{missing}</Num></Badge> : <Badge tone="g">مكتملة</Badge> : undefined}
          />
          <CardBody className="flex flex-col gap-2">
            {requiredDocs.length === 0 && <div className="text-[13px] text-tx3">لا توجد مستندات إلزامية لنوع المشروع.</div>}
            {requiredDocs.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-[13px]">
                <Badge tone={d.have ? "g" : "r"} aria-label={d.have ? "مرفق" : "ناقص"}>
                  {d.have ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
                </Badge>
                {d.name}
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="الملفات المرفقة" sub={<>النسخة <Num>{revision?.n ?? 1}</Num> · <Num>{files.length}</Num> ملف</>} />
          <CardBody className="flex flex-col gap-2">
            {files.length === 0 && <EmptyState icon={Paperclip} title="لا توجد ملفات مرفقة" />}
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-base border border-bd1 px-3 py-2">
                <FileText className="size-5 shrink-0 text-tx3" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold" title={f.fileName}>{f.fileName}</div>
                  <div className="text-xs text-tx3">
                    {f.docType ? `${f.docType.name} · ` : ""}<Num>{fileSizeLabel(f.size)}</Num> · <Num>{formatDate(f.uploadedAt)}</Num>
                  </div>
                </div>
                <a href={`/api/attachments/${f.id}`} className="inline-grid size-7 place-items-center rounded-base text-tx hover:bg-hover" aria-label={`تنزيل ${f.fileName}`} title="تنزيل">
                  <Download className="size-4" aria-hidden />
                </a>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="نسخ المستخلص" sub="تُنشأ نسخة جديدة مع كل إعادة تقديم بعد الاستيفاء" />
        <TableWrap>
          <Table className="text-[13px]">
            <THead>
              <tr><Th>النسخة</Th><Th>التاريخ</Th><Th align="end">البنود</Th><Th align="end">المهمات</Th><Th align="end">المرفقات</Th><Th>الملاحظة</Th><Th /></tr>
            </THead>
            <TBody>
              {[...revisions].reverse().map((r, i) => (
                <Tr key={r.id}>
                  <Td><b className="num">{r.n}</b></Td>
                  <Td><Num>{formatDate(r.createdAt)}</Num></Td>
                  <Td align="end"><Num>{r._count.lines}</Num></Td>
                  <Td align="end"><Num>{r._count.materials}</Num></Td>
                  <Td align="end"><Num>{r._count.attachments}</Num></Td>
                  <Td className="max-w-[320px] truncate text-tx2">{r.note ?? "—"}</Td>
                  <Td>{i === 0 ? <Badge tone="p">الحالية</Badge> : <Badge>سابقة</Badge>}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </Card>
    </div>
  );
}
