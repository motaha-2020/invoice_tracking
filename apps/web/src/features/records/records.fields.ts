/**
 * تعديل وحذف السجلات (مدير النظام فقط — records.manage): تعريف الكيانات وحقول نموذج التعديل.
 * client-safe: نفس التعريف بيترسم في النافذة وبيتحقق منه على السيرفر (records.schema.ts).
 */
export type RecordEntity = "contract" | "ao" | "contractItem" | "aoItem" | "invoice";

export const ENTITY_LABEL: Record<RecordEntity, string> = {
  contract: "العقد",
  ao: "أمر التكليف",
  contractItem: "بند جدول الكميات",
  aoItem: "بند أمر التكليف",
  invoice: "المستخلص",
};

export type SelectOption = { value: string; label: string };

export type FieldSpec = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "checkbox";
  required?: boolean;
  /** أرقام وأكواد: من اليسار لليمين */
  ltr?: boolean;
  hint?: string;
  options?: SelectOption[];
  /** عرض الصف كله في النموذج */
  wide?: boolean;
};

/** قيم النموذج — كلها نصوص (الـ checkbox: "1" / "") */
export type RecordValues = Record<string, string>;

export const AO_STATUS_OPTIONS: SelectOption[] = [
  { value: "active", label: "سارٍ" },
  { value: "pending_approval", label: "بانتظار الاعتماد" },
  { value: "closed", label: "مغلق" },
];

export function aoFields(projects: SelectOption[]): FieldSpec[] {
  return [
    { key: "aoNo", label: "رقم أمر التكليف", type: "text", required: true, ltr: true },
    { key: "aoDate", label: "تاريخ أمر التكليف", type: "date" },
    { key: "status", label: "الحالة", type: "select", required: true, options: AO_STATUS_OPTIONS },
    { key: "name", label: "اسم أمر التكليف / المنطقة", type: "textarea", required: true, wide: true },
    { key: "projectId", label: "المشروع", type: "select", options: [{ value: "", label: "— غير مرتبط بمشروع —" }, ...projects], wide: true, hint: "ربط أمر التكليف بالمشروع يحدد نطاق الاطلاع على مستخلصاته" },
    { key: "value", label: "القيمة الحالية", type: "number", ltr: true },
    { key: "financialCommitment", label: "الارتباط المالي", type: "number", ltr: true },
    { key: "planningAnnexValue", label: "ملحق التخطيط", type: "number", ltr: true },
    { key: "stampsTotal", label: "رسوم الدمغة المسددة", type: "number", ltr: true },
    { key: "finalGuaranteePct", label: "خطاب الضمان النهائي (%)", type: "number", ltr: true },
    { key: "area", label: "النطاق الجغرافي", type: "text" },
    { key: "centralText", label: "السنترال (نص)", type: "text" },
    { key: "outOfScope", label: "خارج النطاق الجغرافي", type: "checkbox" },
    { key: "duration", label: "مدة التنفيذ", type: "textarea", wide: true },
  ];
}

export const CONTRACT_ITEM_FIELDS: FieldSpec[] = [
  { key: "itemNo", label: "رقم البند", type: "text", required: true, ltr: true },
  { key: "unit", label: "الوحدة", type: "text" },
  { key: "isGroup", label: "عنوان (بدون كمية أو سعر)", type: "checkbox" },
  { key: "description", label: "البيان", type: "textarea", required: true, wide: true },
  { key: "contractQty", label: "الكمية التعاقدية", type: "number", ltr: true },
  { key: "unitPrice", label: "سعر الوحدة", type: "number", ltr: true, hint: "فارغ = بند غير مُسعّر (الفئة C5)" },
  { key: "workType", label: "نوع العمل", type: "text" },
];

export const AO_ITEM_FIELDS: FieldSpec[] = [
  { key: "plannedQty", label: "الكمية المخططة", type: "number", required: true, ltr: true },
];

/** مرحلة المستخلص المرحّل: draft / مفتاح مرحلة / on_hold / paid */
export function invoiceFields(workTypes: SelectOption[], stages: SelectOption[] | null): FieldSpec[] {
  const f: FieldSpec[] = [
    { key: "invoiceNo", label: "رقم المستخلص", type: "text", required: true, ltr: true },
    { key: "period", label: "الفترة", type: "text" },
    { key: "pathName", label: "اسم المسار / المنطقة", type: "textarea", required: true, wide: true },
    { key: "workTypeId", label: "نوع الأعمال", type: "select", options: [{ value: "", label: "— غير محدد —" }, ...workTypes] },
  ];
  if (stages) {
    f.push(
      { key: "migratedAmount", label: "المبلغ غير شامل الضريبة", type: "number", required: true, ltr: true },
      { key: "stage", label: "مرحلة الاعتماد الحالية", type: "select", required: true, options: stages, hint: "للمستخلصات المرحّلة فقط — باقي المستخلصات تتحرك من خلال مسار الاعتماد" },
      { key: "paymentRef", label: "رقم الشيك / التحويل", type: "text", ltr: true },
    );
  }
  return f;
}
