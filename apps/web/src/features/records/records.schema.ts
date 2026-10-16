import { z } from "zod";

/** تحويل قيم النموذج (نصوص) لأنواعها — رسائل الخطأ بالعربي */
const str = (label: string, max = 500) => z.string().trim().min(1, `${label} إلزامي`).max(max, `${label} أطول من المسموح`);
const optStr = (max = 500) => z.string().trim().max(max).transform((v) => v || null);
const optNum = (label: string, min = 0) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/,/g, ""))
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= min), `${label}: يرجى إدخال رقم صحيح`)
    .transform((v) => (v === "" ? null : Number(v)));
const reqNum = (label: string) => optNum(label).refine((v) => v != null, `${label} إلزامي`).transform((v) => v!);
const optDate = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), `${label}: تاريخ غير صحيح`)
    .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null));
const bool = z.string().transform((v) => v === "1" || v === "true");

export const aoSchema = z.object({
  aoNo: str("رقم أمر التكليف", 40).transform((v) => v.toUpperCase().replace(/\s+/g, "")),
  aoDate: optDate("تاريخ أمر التكليف"),
  status: z.enum(["active", "pending_approval", "closed"], { message: "حالة أمر التكليف غير صحيحة" }),
  name: str("اسم أمر التكليف"),
  projectId: optStr(64),
  value: optNum("القيمة الحالية"),
  financialCommitment: optNum("الارتباط المالي"),
  planningAnnexValue: optNum("ملحق التخطيط"),
  stampsTotal: optNum("رسوم الدمغة"),
  finalGuaranteePct: optNum("خطاب الضمان النهائي").refine((v) => v == null || v <= 100, "نسبة خطاب الضمان لا تتجاوز 100%"),
  area: optStr(200),
  centralText: optStr(200),
  outOfScope: bool,
  duration: optStr(1000),
});

export const contractItemSchema = z.object({
  itemNo: str("رقم البند", 40),
  unit: optStr(40),
  isGroup: bool,
  description: str("البيان", 4000),
  contractQty: optNum("الكمية التعاقدية"),
  unitPrice: optNum("سعر الوحدة"),
  workType: optStr(100),
});

export const aoItemSchema = z.object({ plannedQty: reqNum("الكمية المخططة") });

export const invoiceSchema = z.object({
  invoiceNo: str("رقم المستخلص", 40),
  period: optStr(60),
  pathName: str("اسم المسار", 1000),
  workTypeId: optStr(64),
});

export const migratedInvoiceSchema = invoiceSchema.extend({
  migratedAmount: reqNum("المبلغ غير شامل الضريبة"),
  stage: str("مرحلة الاعتماد الحالية", 40),
  paymentRef: optStr(100),
});

/** قيمة → نص النموذج */
export function toFormValue(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "boolean") return v ? "1" : "";
  return String(v);
}
