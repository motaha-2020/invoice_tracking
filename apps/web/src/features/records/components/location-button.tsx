"use client";

import { MapPin, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { LocationOptions, LocationPath, Opt } from "../location.service";
import { setAoLocationAction } from "../records.actions";

type Props = {
  aoId: string;
  aoNo: string;
  aoName: string;
  invoices: number;
  current: LocationPath | null;
  options: LocationOptions;
  labeled?: boolean;
};

const EMPTY: LocationPath = { presidencyId: "", sectorId: "", generalDeptId: "", deptId: "", centralId: "", projectId: "" };
const LEVELS = [
  { key: "presidencyId", label: "رئاسة القطاعات", list: "presidencies" },
  { key: "sectorId", label: "القطاع", list: "sectors" },
  { key: "generalDeptId", label: "الإدارة العامة", list: "generalDepts" },
  { key: "deptId", label: "الإدارة المختصة", list: "depts" },
] as const;

/** «ربط بالهيكل»: اختيار متدرج من الرئاسة للسنترال ثم المشروع (أو إنشاء سنترال/مشروع جديد) — لمدير النظام */
export function LocationButton({ aoId, aoNo, aoName, invoices, current, options, labeled = true }: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<LocationPath>(current ?? EMPTY);
  const [newCentral, setNewCentral] = useState("");
  const [newProject, setNewProject] = useState(aoName);
  const [typeId, setTypeId] = useState(options.projectTypes[0]?.id ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const pick = (key: keyof LocationPath, v: string) => {
    setError(undefined);
    setPath((p) => {
      const order: (keyof LocationPath)[] = ["presidencyId", "sectorId", "generalDeptId", "deptId", "centralId", "projectId"];
      const next = { ...p, [key]: v };
      for (const k of order.slice(order.indexOf(key) + 1)) next[k] = "";
      return next;
    });
  };
  const parentOf = (i: number) => (i === 0 ? null : path[LEVELS[i - 1]!.key]);
  const children = (list: Opt[], parent: string | null) => (parent === null ? list : list.filter((o) => o.parentId === parent));

  const save = () =>
    start(async () => {
      const res = await setAoLocationAction(aoId, {
        projectId: path.projectId,
        centralId: path.centralId,
        deptId: path.deptId,
        newCentralName: newCentral,
        newProjectName: newProject,
        projectTypeId: typeId,
      });
      if (!res.ok) return setError(res.message);
      toast.show(res.message ?? "تم الربط", "ok");
      setOpen(false);
    });

  const centrals = children(options.centrals, path.deptId || null);
  const projects = path.centralId && path.centralId !== "new" ? children(options.projects, path.centralId) : [];

  return (
    <>
      <Button size="sm" variant={labeled ? "default" : "gh"} icon={!labeled} onClick={() => { setPath(current ?? EMPTY); setError(undefined); setOpen(true); }} title="ربط بالهيكل" aria-label={`ربط أمر التكليف ${aoNo} بالهيكل`}>
        <MapPin aria-hidden /> {labeled && (current ? "تغيير المكان في الهيكل" : "ربط بالهيكل")}
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          size="lg"
          title={`ربط أمر التكليف ${aoNo} بالهيكل`}
          footer={<><Button variant="pr" disabled={pending || !path.projectId} onClick={save}><Save aria-hidden /> {pending ? "جارٍ الحفظ…" : "حفظ الربط"}</Button><Button onClick={() => setOpen(false)}>إلغاء</Button></>}
        >
          <Alert tone="i">
            يتحدد مكان المستخلص في الهيكل من مشروع أمر التكليف، لذا يسري هذا الربط على جميع مستخلصات أمر التكليف (<span className="num">{invoices}</span>)،
            ويحدد نطاق الاطلاع ومستلمي البريد الإلكتروني والتقارير.
          </Alert>
          <div className="grid gap-3 sm:grid-cols-2">
            {LEVELS.map((l, i) => {
              const parent = parentOf(i);
              const list = children(options[l.list], parent === null ? null : parent || "__none__");
              return (
                <Field key={l.key} label={l.label} htmlFor={`loc-${l.key}`}>
                  <Select id={`loc-${l.key}`} value={path[l.key]} disabled={i > 0 && !parent} onChange={(e) => pick(l.key, e.target.value)}>
                    <option value="">— اختر —</option>
                    {list.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </Select>
                </Field>
              );
            })}
            <Field label="السنترال" htmlFor="loc-central" hint={path.deptId && !centrals.length ? "لا توجد سنترالات مسجلة لهذه الإدارة — يمكنك إضافة سنترال جديد" : undefined}>
              <Select id="loc-central" value={path.centralId} disabled={!path.deptId} onChange={(e) => { pick("centralId", e.target.value); if (e.target.value === "new") setPath((p) => ({ ...p, centralId: "new", projectId: "new" })); }}>
                <option value="">— اختر —</option>
                {centrals.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                <option value="new">+ سنترال جديد…</option>
              </Select>
            </Field>
            {path.centralId === "new" && (
              <Field label="اسم السنترال الجديد" htmlFor="loc-new-central" required>
                <Input id="loc-new-central" value={newCentral} onChange={(e) => setNewCentral(e.target.value)} />
              </Field>
            )}
            <Field label="المشروع" htmlFor="loc-project" className="sm:col-span-2">
              <Select id="loc-project" value={path.projectId} disabled={!path.centralId} onChange={(e) => setPath((p) => ({ ...p, projectId: e.target.value }))}>
                <option value="">— اختر —</option>
                {projects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                <option value="new">+ مشروع جديد باسم أمر التكليف…</option>
              </Select>
            </Field>
            {path.projectId === "new" && (
              <>
                <Field label="اسم المشروع الجديد" htmlFor="loc-new-project" required>
                  <Input id="loc-new-project" value={newProject} onChange={(e) => setNewProject(e.target.value)} />
                </Field>
                <Field label="نوع المشروع" htmlFor="loc-type" required>
                  <Select id="loc-type" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                    {options.projectTypes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </Select>
                </Field>
              </>
            )}
          </div>
          {error && <Alert tone="r">{error}</Alert>}
        </Modal>
      )}
    </>
  );
}
