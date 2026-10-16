"use client";

import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, Badge, Card, CardBody, CardHeader, Field, Input, Money, Num, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { AoWorkspace, ContractOption, DraftState, WorkTypeOption } from "../../draft.types";

type Props = {
  d: DraftState;
  set: (p: Partial<DraftState>) => void;
  contracts: ContractOption[];
  workTypes: WorkTypeOption[];
  ws: AoWorkspace | null;
  errors: { text: string }[];
};

/** الخطوة 1: العقد وأمر التكليف وبيانات المستخلص */
export function StepBasics({ d, set, contracts, workTypes, ws, errors }: Props) {
  const contract = contracts.find((c) => c.id === d.contractId);
  const err = (key: string) => errors.find((e) => e.text.includes(key))?.text;
  const used = ws && ws.ao.value > 0 ? (ws.billed / ws.ao.value) * 100 : 0;
  const kv = (label: string, v: ReactNode) => (
    <div><dt className="text-xs text-tx3">{label}</dt><dd className="m-0 mt-0.5 font-semibold">{ws ? v : "—"}</dd></div>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="العقد وأمر التكليف" />
          <CardBody className="flex flex-col gap-3">
            <Field label="العقد" htmlFor="w-contract" required>
              <Select id="w-contract" value={d.contractId} onChange={(e) => set({ contractId: e.target.value, aoId: "", siteCode: "" })}>
                <option value="">اختر العقد</option>
                {contracts.map((c) => <option key={c.id} value={c.id}>{c.contractNo} — {c.title}</option>)}
              </Select>
            </Field>
            <Field label="أمر التكليف" htmlFor="w-ao" required error={err("أمر التكليف")}>
              <Select
                id="w-ao"
                value={d.aoId}
                disabled={!contract}
                aria-invalid={!!err("أمر التكليف")}
                onChange={(e) => {
                  const ao = contract?.aos.find((a) => a.id === e.target.value);
                  set({ aoId: e.target.value, siteCode: "", ...(ao && !d.pathName ? { pathName: (ao.project ?? ao.name).split("—")[0]!.trim() } : {}) });
                }}
              >
                <option value="">{contract ? (contract.aos.length ? "اختر أمر التكليف" : "لا توجد أوامر تكليف سارية على هذا العقد") : "اختر العقد أولاً"}</option>
                {contract?.aos.map((a) => (
                  <option key={a.id} value={a.id}>{a.aoNo} — {a.project ?? a.name}{a.pending ? " (بانتظار الاعتماد)" : ""}</option>
                ))}
              </Select>
            </Field>
            {ws && ws.sites.length > 0 && (
              <Field label="الموقع / الكابينة" htmlFor="w-site" hint="اختياري — يُطبَّق على البنود التي لا تتضمن كود موقع">
                <Select id="w-site" value={d.siteCode} onChange={(e) => set({ siteCode: e.target.value })}>
                  <option value="">غير محدد (أو من ملف البنود)</option>
                  {ws.sites.map((s) => <option key={s.code} value={s.code}>{s.code}{s.name ? ` — ${s.name}` : ""}</option>)}
                </Select>
              </Field>
            )}
            {ws?.ao.pending && <Alert tone="a">أمر التكليف بانتظار الاعتماد — قد يُوقف المستخلص مؤقتاً لحين اعتماده.</Alert>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="بيانات المستخلص" />
          <CardBody className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="رقم المستخلص" htmlFor="w-no" required error={err("رقم المستخلص")}>
                <Input id="w-no" dir="ltr" className="text-start" value={d.invoiceNo} placeholder="مثال: 206" aria-invalid={!!err("رقم المستخلص")} onChange={(e) => set({ invoiceNo: e.target.value })} />
              </Field>
              <Field label="نوع الأعمال" htmlFor="w-wt" required error={err("نوع الأعمال")}>
                <Select id="w-wt" value={d.workTypeId} onChange={(e) => set({ workTypeId: e.target.value })}>
                  <option value="">اختر نوع الأعمال</option>
                  {workTypes.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="اسم المسار" htmlFor="w-path" required error={err("اسم المسار")}>
              <Input id="w-path" value={d.pathName} placeholder="مثال: أعمال مدنية FTTH طلخا — كابينة 75" aria-invalid={!!err("اسم المسار")} onChange={(e) => set({ pathName: e.target.value })} />
            </Field>
            <Field label="الفترة" htmlFor="w-period" hint="الشهر أو المدة التي نُفذت فيها الأعمال">
              <Input id="w-period" value={d.period} onChange={(e) => set({ period: e.target.value })} />
            </Field>
            {workTypes.find((w) => w.id === d.workTypeId)?.isPlanning && (
              <Alert tone="i">مستخلص أعمال التخطيط يُسدَّد بالكامل بعد الانتهاء دون مبالغ محتجزة.</Alert>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="بيانات أمر التكليف" sub={<span className="inline-flex items-center gap-1"><Lock className="size-3.5" aria-hidden /> تُستكمل تلقائياً من أمر التكليف</span>} />
        <CardBody>
          <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-5 gap-y-3">
            {kv("رئاسة القطاعات", ws?.org.presidency)}
            {kv("القطاع", ws?.org.sector)}
            {kv("الإدارة العامة", ws?.org.generalDept)}
            {kv("الإدارة المختصة", ws?.org.dept)}
            {kv("السنترال", ws?.org.central)}
            {kv("نوع المشروع", ws?.org.projectType)}
            {kv("المشروع", ws?.org.project)}
          </dl>
        </CardBody>
        {ws && (
          <CardBody className="border-t border-bd1">
            <div className="flex flex-wrap justify-between gap-2 text-[13px]">
              <b>قيمة أمر التكليف <Money>{formatMoney(ws.ao.value)}</Money> جنيه</b>
              <span className="text-tx3">
                المفوتر سابقاً <Money>{formatMoney(ws.billed)}</Money> جنيه في <Num>{ws.billedCount}</Num> مستخلص · <Num>{`${used.toFixed(1)}%`}</Num>
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken">
              <div className={cn("h-full rounded-full", used > 100 ? "bg-cr6" : used > 85 ? "bg-wa6" : "bg-brand")} style={{ width: `${Math.min(100, used)}%` }} />
            </div>
            {ws.ao.financialCommitment != null && ws.ao.financialCommitment < ws.ao.value && (
              <Badge tone="a" className="mt-2">الارتباط المالي المعتمد <Num>{formatMoney(ws.ao.financialCommitment, { decimals: 0 })}</Num> جنيه</Badge>
            )}
          </CardBody>
        )}
      </Card>
    </div>
  );
}
