"use client";

import { KeyRound, Save, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Num, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { saveSmtpAction, testSmtpAction } from "../smtp.actions";
import type { SmtpView } from "../smtp.service";

const PRESETS = [
  { label: "Office 365 / Outlook", host: "smtp.office365.com", port: "587", security: "starttls" },
  { label: "Gmail / Google Workspace", host: "smtp.gmail.com", port: "587", security: "starttls" },
] as const;

/** «خادم البريد الإلكتروني» — مدير النظام يعدّل ويختبر؛ غيره بيشوف الحالة بس */
export function SmtpForm({ view }: { view: SmtpView }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ ...view.form, password: "", clearPassword: false });
  const [error, setError] = useState<string>();
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const ro = !view.canEdit;

  const save = () =>
    start(async () => {
      const res = await saveSmtpAction({ ...f, password: f.password || undefined });
      if (!res.ok) return setError(res.message);
      setError(undefined);
      set({ password: "", clearPassword: false, hasPassword: f.clearPassword ? false : f.hasPassword || !!f.password });
      toast.show(res.message ?? "", "ok");
    });

  const test = () =>
    start(async () => {
      const res = await testSmtpAction();
      if (!res.ok) return setError(res.message);
      setError(undefined);
      toast.show(res.message ?? "", "ok");
    });

  const a = view.active;
  return (
    <Card>
      <CardHeader title="خادم البريد الإلكتروني (SMTP)" sub="الحساب الذي تُرسل منه الدعوات والتنبيهات والتقارير" />
      <CardBody className="flex flex-col gap-3">
        {a?.passwordBroken ? (
          <Alert tone="r" title="تعذّر قراءة كلمة المرور المحفوظة">تغيّر مفتاح التشفير على الخادم — يرجى إعادة إدخال كلمة المرور وحفظ الإعدادات.</Alert>
        ) : a ? (
          <Alert tone="g">
            الإرسال مفعّل عبر <Num>{a.host}</Num>{a.from && <> من <Num>{a.from}</Num></>}
            {a.source === "env" && " — من إعدادات الخادم (ملف .env). الحفظ هنا يحل محلها."}
          </Alert>
        ) : (
          <Alert tone="a">الإرسال غير مفعّل — تُحفظ الرسائل في سجل البريد بحالة «قيد الإرسال» وتُرسل تلقائياً فور ضبط الخادم.</Alert>
        )}
        {error && <Alert tone="r">{error}</Alert>}

        {!ro && (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-tx2">
            إعداد سريع:
            {PRESETS.map((p) => (
              <Button key={p.host} size="sm" onClick={() => set({ host: p.host, port: p.port, security: p.security })}>{p.label}</Button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)_110px_170px] gap-3 max-sm:grid-cols-1">
          <Field label="الخادم" htmlFor="smtp-host" hint="اتركه فارغاً لإيقاف الإرسال">
            <Input id="smtp-host" dir="ltr" readOnly={ro} value={f.host} placeholder="smtp.office365.com" onChange={(e) => set({ host: e.target.value })} />
          </Field>
          <Field label="المنفذ" htmlFor="smtp-port">
            <Input id="smtp-port" dir="ltr" inputMode="numeric" readOnly={ro} value={f.port} onChange={(e) => set({ port: e.target.value })} />
          </Field>
          <Field label="التشفير" htmlFor="smtp-sec">
            <Select id="smtp-sec" disabled={ro} value={f.security} onChange={(e) => set({ security: e.target.value as "starttls" | "ssl" })}>
              <option value="starttls">STARTTLS (587)</option>
              <option value="ssl">SSL/TLS (465)</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="اسم المستخدم" htmlFor="smtp-user">
            <Input id="smtp-user" dir="ltr" autoComplete="off" readOnly={ro} value={f.user} placeholder="invoices@example.com" onChange={(e) => set({ user: e.target.value })} />
          </Field>
          {!ro && (
            <Field
              label="كلمة المرور"
              htmlFor="smtp-pass"
              hint={f.clearPassword ? "ستُحذف كلمة المرور المحفوظة عند الحفظ" : f.hasPassword ? "محفوظة ومشفّرة — اتركها فارغة للإبقاء عليها" : "تُحفظ مشفّرة ولا تظهر مرة أخرى"}
            >
              <div className="flex gap-2">
                <Input id="smtp-pass" type="password" dir="ltr" autoComplete="new-password" value={f.password} placeholder={f.hasPassword ? "••••••••" : ""} onChange={(e) => set({ password: e.target.value, clearPassword: false })} />
                {f.hasPassword && !f.clearPassword && (
                  <Button size="sm" variant="gh" title="حذف كلمة المرور المحفوظة" onClick={() => set({ password: "", clearPassword: true })}><KeyRound aria-hidden /> حذف</Button>
                )}
              </div>
            </Field>
          )}
          <Field label="عنوان المرسل" htmlFor="smtp-from" hint="يظهر للمستلم — غالباً نفس اسم المستخدم">
            <Input id="smtp-from" dir="ltr" type="email" readOnly={ro} value={f.from} onChange={(e) => set({ from: e.target.value })} />
          </Field>
          <Field label="اسم المرسل" htmlFor="smtp-name">
            <Input id="smtp-name" readOnly={ro} value={f.fromName} onChange={(e) => set({ fromName: e.target.value })} />
          </Field>
        </div>

        {ro ? (
          <div className="text-xs text-tx3">تعديل إعدادات البريد متاح لمدير النظام فقط.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="pr" disabled={pending} onClick={save}><Save aria-hidden /> {pending ? "جارٍ التنفيذ…" : "حفظ إعدادات البريد"}</Button>
            <Button disabled={pending || !a} onClick={test} title={a ? undefined : "احفظ الإعدادات أولاً"}><Send aria-hidden /> إرسال رسالة تجريبية إلى بريدي</Button>
          </div>
        )}
        <div className="text-xs text-tx3">
          ملاحظة: منفذا 25 و465 قد يكونان مغلقين على الخادم — استخدم 587. وفي Gmail يلزم إنشاء «App Password» من إعدادات حساب Google.
        </div>
      </CardBody>
    </Card>
  );
}
