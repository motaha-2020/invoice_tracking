"use client";

import { FolderKanban, FolderSearch } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Card, CardHeader, EmptyState, Input, Num, Select, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { ProjectRow, ProjectTypeRow } from "../org.service";
import { AddButton, RowActions } from "./org-buttons";
import { useOrgDialogs } from "./org-dialogs";
import { projectRecord } from "./node-detail";

/** جدول المشروعات: النوع، السنترال، المكان الكامل في الهيكل، وعدد أوامر التكليف والمستخلصات */
export function ProjectsTable({ projects, types }: { projects: ProjectRow[]; types: ProjectTypeRow[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const { canEdit } = useOrgDialogs();
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return projects.filter(
      (p) =>
        (!type || p.typeId === type) &&
        (!term || [p.code, p.name, p.centralName, ...p.path].join(" ").toLowerCase().includes(term)),
    );
  }, [projects, q, type]);

  if (!projects.length) {
    return (
      <Card>
        <EmptyState icon={FolderKanban} title="لا توجد مشروعات بعد" action={<AddButton kind="project" label="إضافة أول مشروع" />}>
          <div className="text-[13px]">
            {types.length ? "يمكن إضافة مشروع وربطه بسنترال، أو استيراد نموذج المشروعات." : "يرجى البدء بإضافة أنواع المشروعات (مثل FTTH)، ثم المشروعات."}
          </div>
        </EmptyState>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="المشروعات" sub={<Num>{rows.length === projects.length ? projects.length : `${rows.length} من ${projects.length}`}</Num>} />
      <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-2 border-b border-bd1 px-[18px] py-2.5 max-sm:grid-cols-1 max-sm:px-3">
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="البحث بالمشروع أو السنترال أو الإدارة…" aria-label="بحث في المشروعات" />
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="نوع المشروع">
          <option value="">جميع الأنواع</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={FolderSearch} title="لا توجد مشروعات مطابقة لمعايير التصفية" />
      ) : (
        <TableWrap>
          <Table className="text-sm">
            <THead>
              <Tr>
                <Th>الكود</Th>
                <Th>المشروع</Th>
                <Th>النوع</Th>
                <Th>السنترال</Th>
                <Th>الموقع في الهيكل التنظيمي</Th>
                <Th align="end">أوامر تكليف</Th>
                <Th align="end">مستخلصات</Th>
                {canEdit && <Th><span className="sr-only">إجراءات</span></Th>}
              </Tr>
            </THead>
            <TBody>
              {rows.map((p) => (
                <Tr key={p.id}>
                  <Td className="num whitespace-nowrap text-xs text-tx2">{p.code}</Td>
                  <Td className="min-w-[180px]">
                    <b className="font-semibold">{p.name}</b>
                    {(p.startDate || p.notes) && (
                      <div className="text-xs text-tx3">
                        {p.startDate && <>تاريخ البدء <Num>{formatDate(p.startDate)}</Num></>}
                        {p.startDate && p.notes && " · "}
                        {p.notes}
                      </div>
                    )}
                  </Td>
                  <Td><Badge>{p.typeName}</Badge></Td>
                  <Td className="whitespace-nowrap">{p.centralName}</Td>
                  <Td className="min-w-[200px] text-xs text-tx3">{p.path.join(" · ") || "—"}</Td>
                  <Td align="end"><Num>{p.aoCount}</Num></Td>
                  <Td align="end"><Num>{p.invoices}</Num></Td>
                  {canEdit && (
                    <Td align="end" className="whitespace-nowrap">
                      <RowActions kind="project" record={projectRecord(p)} />
                    </Td>
                  )}
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </Card>
  );
}
