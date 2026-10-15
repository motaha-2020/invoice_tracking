"use client";

import { Save } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { saveSettingsAction } from "../workflow.actions";
import { WEEK_DAYS, type EditableSettings } from "../workflow.rules";

type Props = { values: EditableSettings; smtp: { host: string; port: string; from: string; fromName: string } };

/** الإعدادات العامة. بيانات SMTP عرض بس — السر (user/password) في .env على السيرفر */
export function SettingsForm({ values, smtp }: Props) {
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
    <div className="grid grid-cols-2 items-start gap-4 max-xl:grid-cols-1">
      <Card>
        <CardHeader title="التنبيهات والتقارير" />
        <CardBody className="flex flex-col gap-3">
          {error && <Alert tone="r">{error}</Alert>}
          <Field label="التنبيه الأصفر قبل الميعاد بـ (يوم عمل)" htmlFor="s-warn" hint="المستخلص بيتعلّم أصفر لما يفضل على الـ SLA العدد ده أو أقل">
            <Input id="s-warn" type="number" min={0} max={10} className="w-28" value={f.slaWarnAt} onChange={(e) => setF((x) => ({ ...x, slaWarnAt: e.target.value }))} />
          </Field>
          <Field label="ملخص يومي الساعة" htmlFor="s-digest" hint="ملخص بالمتأخر والقريب من الميعاد لكل مسؤول (بتوقيت القاهرة)">
            <Input id="s-digest" type="time" className="w-36" value={f.dailyDigestAt} onChange={(e) => setF((x) => ({ ...x, dailyDigestAt: e.target.value }))} />
          </Field>
          <Field label="التقرير الأسبوعي يوم" htmlFor="s-week">
            <Select id="s-week" className="w-40" value={f.weeklyReportDay} onChange={(e) => setF((x) => ({ ...x, weeklyReportDay: e.target.value as EditableSettings["weeklyReportDay"] }))}>
              {WEEK_DAYS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <div><Button variant="pr" disabled={pending} onClick={save}><Save aria-hidden /> {pending ? "بيتحفظ…" : "حفظ"}</Button></div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="إعدادات الإرسال (SMTP)" sub="عرض بس" />
        <CardBody className="space-y-2 text-sm">
          {[
            ["السيرفر", smtp.host],
            ["البورت", smtp.port],
            ["الإرسال من", smtp.from],
            ["اسم المرسل", smtp.fromName],
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between gap-3 border-b border-bd1 pb-1.5 last:border-b-0">
              <span className="text-tx2">{l}</span>
              <b dir="ltr">{v || "—"}</b>
            </div>
          ))}
          <Alert tone="i">
            اسم المستخدم وكلمة السر بتوع الإيميل متخزنين في ملف <span dir="ltr">.env</span> على السيرفر بس — مش في قاعدة البيانات ولا في الشاشة. لحد ما
            الإرسال يتربط، الدعوات والإشعارات بتتسجل في صندوق الصادر (سجل الإيميلات).
          </Alert>
        </CardBody>
      </Card>
    </div>
  );
}
