/**
 * حقول فورم الإضافة/التعديل لكل نوع — وصف بس، والفورم نفسه في org-dialogs.tsx.
 * أسماء الحقول = نفس مفاتيح org.schema.ts.
 */
import type { OrgKind } from "../org.kinds";

/** قوايم الاختيار اللي بتيجي من السيرفر */
export type OptionsKey = "presidency" | "sector" | "generalDept" | "dept" | "central" | "projectType";
export type SelectOption = { id: string; label: string; group?: string };
export type OrgOptions = Record<OptionsKey, SelectOption[]>;

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "email" | "date" | "number" | "textarea" | "select" | "checkbox";
  required?: boolean;
  options?: OptionsKey;
  ltr?: boolean;
  hint?: string;
  /** نص جنب الـ checkbox */
  checkLabel?: string;
  /** القيمة في فورم الإضافة (checkbox: "1" = متعلّم) */
  initial?: string;
  /** ياخد عرض الفورم كله (في الشبكة بعمودين) */
  wide?: boolean;
};

const nameField = (label = "الاسم"): FieldDef => ({ name: "name", label, type: "text", required: true, wide: true });

export const ENTITY_FIELDS: Record<OrgKind, FieldDef[]> = {
  presidency: [nameField("اسم رئاسة القطاعات")],
  sector: [nameField("اسم القطاع"), { name: "presidencyId", label: "رئاسة القطاعات", type: "select", options: "presidency", required: true, wide: true }],
  techUnit: [
    nameField(),
    { name: "sectorId", label: "القطاع", type: "select", options: "sector", required: true, wide: true, hint: "الشئون الفنية بتراجع مستخلصات القطاع كله" },
  ],
  generalDept: [nameField("اسم الإدارة العامة"), { name: "sectorId", label: "القطاع", type: "select", options: "sector", required: true, wide: true }],
  dept: [nameField("اسم الإدارة المختصة"), { name: "generalDeptId", label: "الإدارة العامة", type: "select", options: "generalDept", required: true, wide: true }],
  central: [nameField("اسم السنترال"), { name: "deptId", label: "الإدارة المختصة", type: "select", options: "dept", required: true, wide: true }],
  projectType: [nameField("نوع المشروع")],
  workType: [
    nameField("نوع الأعمال"),
    { name: "isPlanning", label: "طريقة الصرف", type: "checkbox", checkLabel: "مستخلص تخطيط", hint: "مستخلص التخطيط بيتصرف 100% بعد الانتهاء" },
    { name: "active", label: "الحالة", type: "checkbox", checkLabel: "شغال (بيظهر في الاختيار)", initial: "1" },
    { name: "sort", label: "الترتيب", type: "number", ltr: true, initial: "0", hint: "الأصغر بيظهر الأول" },
  ],
  project: [
    nameField("اسم المشروع / المنطقة"),
    { name: "typeId", label: "نوع المشروع", type: "select", options: "projectType", required: true },
    { name: "centralId", label: "السنترال", type: "select", options: "central", required: true, hint: "ومنه بيتعرف مكان المشروع في الهيكل" },
    { name: "startDate", label: "تاريخ البدء", type: "date" },
    { name: "notes", label: "ملاحظات", type: "textarea", wide: true },
  ],
  company: [
    { name: "name", label: "الاسم المختصر", type: "text", required: true },
    { name: "email", label: "إيميل المستخلصات", type: "email", required: true, ltr: true, hint: "عليه بيوصل إشعار الصرف وجاهزية الشيك" },
    { name: "fullName", label: "الاسم الكامل", type: "text", required: true, wide: true },
    { name: "commercialReg", label: "السجل التجاري", type: "text", ltr: true },
    { name: "taxNo", label: "البطاقة الضريبية", type: "text", ltr: true },
    { name: "phone", label: "التليفون", type: "text", ltr: true },
    { name: "address", label: "العنوان", type: "text", wide: true },
  ],
};
