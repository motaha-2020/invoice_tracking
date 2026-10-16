"use client";

import { Save } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { saveSettingsAction } from "../workflow.actions";
import { WEEK_DAYS, type EditableSettings } from "../workflow.rules";

type Props = { values: EditableSettings };

/** الإعدادات العامة (التنبيهات والتقارير) — خادم البريد في SmtpForm */
export function SettingsForm({ values }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ slaWarnAt: String(values.slaWarnAt), dailyDigestAt: values.dailyDigestAt, weeklyReportDay: values.weeklyReportDay });
  const [error, setError] = useState<string>();

  const save = () =>
    start(async () => {
      const res = await saveSettingsAction(f);
      if (!res.ok) return setError(res.message);
      setError(undefined);
      toast.show(res.message ?? "", "ok");
    });

  return (
    <Card>
        <CardHeader title="التنبيهات والتقارير" />
        <CardBody className="flex flex-col gap-3">
          {error && <Alert tone="r">{error}</Alert>}
          <Field label="التنبيه قبل انتهاء المدة بـ (يوم عمل)" htmlFor="s-warn" hint="يُميَّز المستخلص بحالة «قارب على الانتهاء» عندما يتبقى من المدة المستهدفة (SLA) هذا العدد من الأيام أو أقل">
            <Input id="s-warn" type="number" min={0} max={10} className="w-28" value={f.slaWarnAt} onChange={(e) => setF((x) => ({ ...x, slaWarnAt: e.target.value }))} />
          </Field>
          <Field label="موعد الملخص اليومي" htmlFor="s-digest" hint="ملخص بالمستخلصات المتجاوزة للمدة والتي قاربت على الانتهاء لكل مسؤول (بتوقيت القاهرة)">
            <Input id="s-digest" type="time" className="w-36" value={f.dailyDigestAt} onChange={(e) => setF((x) => ({ ...x, dailyDigestAt: e.target.value }))} />
          </Field>
          <Field label="يوم التقرير الأسبوعي" htmlFor="s-week">
            <Select id="s-week" className="w-40" value={f.weeklyReportDay} onChange={(e) => setF((x) => ({ ...x, weeklyReportDay: e.target.value as EditableSettings["weeklyReportDay"] }))}>
              {WEEK_DAYS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <div><Button variant="pr" disabled={pending} onClick={save}><Save aria-hidden /> {pending ? "جارٍ الحفظ…" : "حفظ"}</Button></div>
        </CardBody>
    </Card>
  );
}
