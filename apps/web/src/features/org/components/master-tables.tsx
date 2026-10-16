import { Briefcase, Layers } from "lucide-react";
import { Card, CardHeader, EmptyState, Num, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import type { CompanyRow, ProjectTypeRow } from "../org.service";
import { AddButton, RowActions } from "./org-buttons";

/** أنواع المشروعات — النوع بيحدد المستندات الإلزامية في المستخلص */
export function TypesTable({ types, canEdit }: { types: ProjectTypeRow[]; canEdit: boolean }) {
  return (
    <Card>
      <CardHeader title="أنواع المشروعات" sub="يحدد نوع المشروع المستندات الإلزامية في المستخلص (تُضبط من شاشة مسار الاعتماد)" />
      {types.length === 0 ? (
        <EmptyState icon={Layers} title="لا توجد أنواع مشروعات" action={<AddButton kind="projectType" label="إضافة أول نوع مشروع" />} />
      ) : (
        <TableWrap>
          <Table className="text-sm">
            <THead>
              <Tr>
                <Th>الكود</Th>
                <Th>النوع</Th>
                <Th align="end">مشروعات</Th>
                <Th align="end">مستندات إلزامية</Th>
                {canEdit && <Th><span className="sr-only">إجراءات</span></Th>}
              </Tr>
            </THead>
            <TBody>
              {types.map((t) => (
                <Tr key={t.id}>
                  <Td className="num whitespace-nowrap text-xs text-tx2">{t.code}</Td>
                  <Td><b className="font-semibold">{t.name}</b></Td>
                  <Td align="end"><Num>{t.projects}</Num></Td>
                  <Td align="end"><Num>{t.requiredDocs}</Num></Td>
                  {canEdit && (
                    <Td align="end" className="whitespace-nowrap">
                      <RowActions kind="projectType" record={{ id: t.id, code: t.code, name: t.name }} />
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

export function CompaniesTable({ companies, canEdit }: { companies: CompanyRow[]; canEdit: boolean }) {
  return (
    <Card>
      <CardHeader title="الشركات المنفذة" sub={<Num>{companies.length}</Num>} />
      {companies.length === 0 ? (
        <EmptyState icon={Briefcase} title="لا توجد شركات منفذة بعد" action={<AddButton kind="company" label="إضافة أول شركة منفذة" />}>
          <div className="text-[13px]">يمكن إضافة الشركة المنفذة يدوياً أو استيراد نموذج الشركات المنفذة.</div>
        </EmptyState>
      ) : (
        <TableWrap>
          <Table className="text-sm">
            <THead>
              <Tr>
                <Th>الكود</Th>
                <Th>الشركة المنفذة</Th>
                <Th>البريد الإلكتروني للمستخلصات</Th>
                <Th>رقم الهاتف</Th>
                <Th align="end">عقود</Th>
                <Th align="end">مستخلصات</Th>
                {canEdit && <Th><span className="sr-only">إجراءات</span></Th>}
              </Tr>
            </THead>
            <TBody>
              {companies.map((c) => (
                <Tr key={c.id}>
                  <Td className="num whitespace-nowrap text-xs text-tx2">{c.code}</Td>
                  <Td className="min-w-[200px]">
                    <b className="font-semibold">{c.name}</b>
                    <div className="text-xs text-tx3">{c.fullName}</div>
                  </Td>
                  <Td className="text-end text-xs" dir="ltr">{c.email ?? "—"}</Td>
                  <Td className="num whitespace-nowrap text-xs">{c.phone ?? "—"}</Td>
                  <Td align="end"><Num>{c.contracts}</Num></Td>
                  <Td align="end"><Num>{c.invoices}</Num></Td>
                  {canEdit && (
                    <Td align="end" className="whitespace-nowrap">
                      <RowActions
                        kind="company"
                        record={{
                          id: c.id,
                          code: c.code,
                          name: c.name,
                          fullName: c.fullName,
                          email: c.email ?? "",
                          phone: c.phone ?? "",
                          commercialReg: c.commercialReg ?? "",
                          taxNo: c.taxNo ?? "",
                          address: c.address ?? "",
                        }}
                      />
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
