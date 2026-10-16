"use client";

import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Alert, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Select, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { addHolidayAction, deleteHolidayAction } from "../workflow.actions";

type Holiday = { date: string; name: string };
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const dayName = (iso: string) => DAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];

/** الأجازات الرسمية — مش بتتحسب في الـ SLA زي الجمعة والسبت */
export function HolidaysPanel({ holidays, today }: { holidays: Holiday[]; today: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const years = useMemo(() => [...new Set(holidays.map((h) => h.date.slice(0, 4)))].sort().reverse(), [holidays]);
  const [year, setYear] = useState(() => (years.includes(today.slice(0, 4)) ? today.slice(0, 4) : (years[0] ?? "")));
  const [f, setF] = useState({ date: "", name: "" });
  const [error, setError] = useState<string>();
  const list = holidays.filter((h) => !year || h.date.startsWith(year));
  const next = holidays.find((h) => h.date >= today);

  const add = () =>
    start(async () => {
      const res = await addHolidayAction(f);
      if (!res.ok) return setError(res.message);
      setError(undefined);
      if (!years.includes(f.date.slice(0, 4))) setYear(f.date.slice(0, 4));
      setF({ date: "", name: "" });
      toast.show(res.message ?? "", "ok");
    });

  const remove = (date: string) =>
    start(async () => {
      const res = await deleteHolidayAction(date);
      toast.show(res.message ?? "", res.ok ? "ok" : "err");
    });

  return (
    <div className="grid grid-cols-[2fr_1fr] items-start gap-4 max-xl:grid-cols-1">
      <Card>
        <CardHeader
          title="العطلات الرسمية"
          sub="لا تُحتسب ضمن المدة المستهدفة (SLA)"
          actions={
            years.length > 1 && (
              <Select aria-label="السنة" value={year} onChange={(e) => setYear(e.target.value)} className="w-auto">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            )
          }
        />
        {list.length === 0 ? (
          <EmptyState icon={CalendarOff} title="لا توجد عطلات مسجلة" />
        ) : (
          <TableWrap>
            <Table className="text-sm">
              <THead>
                <Tr><Th>التاريخ</Th><Th>اليوم</Th><Th>المناسبة</Th><Th /></Tr>
              </THead>
              <TBody>
                {list.map((h) => (
                  <Tr key={h.date} selected={h.date >= today}>
                    <Td><span className="num">{formatDate(h.date)}</span></Td>
                    <Td className="text-xs">{dayName(h.date)}</Td>
                    <Td>{h.name}</Td>
                    <Td align="end">
                      <Button size="sm" variant="gh" icon aria-label="حذف العطلة" disabled={pending} onClick={() => remove(h.date)}><Trash2 /></Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader title="إضافة عطلة رسمية" />
          <CardBody className="flex flex-col gap-3">
            {error && <Alert tone="r">{error}</Alert>}
            <Field label="التاريخ" htmlFor="h-date" required>
              <Input id="h-date" type="date" value={f.date} onChange={(e) => setF((x) => ({ ...x, date: e.target.value }))} />
            </Field>
            <Field label="المناسبة" htmlFor="h-name" required>
              <Input id="h-name" value={f.name} maxLength={120} placeholder="مثال: عيد الفطر" onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} />
            </Field>
            <Button variant="pr" disabled={pending} onClick={add}><Plus aria-hidden /> إضافة</Button>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-sm">
            <div className="flex justify-between py-1"><span className="text-tx2">العطلات القادمة</span><b className="num">{holidays.filter((h) => h.date >= today).length}</b></div>
            <div className="flex justify-between gap-2 py-1">
              <span className="text-tx2">أقرب عطلة</span>
              <b>{next ? <><span className="num">{formatDate(next.date)}</span> · {next.name}</> : "—"}</b>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
