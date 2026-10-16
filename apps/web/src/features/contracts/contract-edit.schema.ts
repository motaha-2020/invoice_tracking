import { z } from "zod";

/** نموذج «تعديل بيانات العقد» — الأرقام بتيجي نصوص من الشاشة (فاضي = مش محدد للحقول الاختيارية) */
const toNum = (v: unknown) => (v === "" || v == null ? null : typeof v === "number" ? v : Number(String(v).replace(/[,\s]/g, "")));

const pct = (label: string, max = 100) =>
  z.preprocess(toNum, z.number({ error: `${label}: يرجى إدخال رقم صحيح` }).min(0, `${label} لا يقل عن 0`).max(max, `${label} لا يزيد عن ${max}`));
const optPct = (label: string, max = 100) =>
  z.preprocess(toNum, z.number({ error: `${label}: يرجى إدخال رقم صحيح` }).min(0, `${label} لا يقل عن 0`).max(max, `${label} لا يزيد عن ${max}`).nullable());
const optDate = (label: string) =>
  z.preprocess((v) => (v === "" || v == null ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label}: التاريخ غير صحيح`).nullable());

export const contractEditSchema = z
  .object({
    title: z.string().trim().min(1, "يرجى إدخال موضوع العقد").max(1000, "موضوع العقد أطول من الحد المسموح"),
    contractValue: z.preprocess(toNum, z.number({ error: "قيمة العقد: يرجى إدخال رقم صحيح" }).positive("قيمة العقد يجب أن تكون أكبر من صفر").max(1e13).nullable()),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "العملة: ثلاثة حروف مثل EGP"),
    awardDate: optDate("تاريخ برقية القبول"),
    startDate: optDate("تاريخ البدء"),
    endDate: optDate("تاريخ الانتهاء"),
    payMonthlyPct: pct("نسبة الصرف الشهري"),
    payAsbuiltPct: pct("نسبة As-Built"),
    payHandoverPct: pct("نسبة الاستلام الابتدائي"),
    planningPayPct: pct("نسبة سداد أعمال التخطيط"),
    vatPct: pct("ضريبة القيمة المضافة"),
    taxPct: optPct("الخصم من المنبع"),
    finalGuaranteePct: pct("خطاب الضمان النهائي"),
    delayFinePctWeek: optPct("غرامة التأخير الأسبوعية"),
    delayFineCapPct: optPct("الحد الأقصى للغرامة"),
    warrantyMonths: z.preprocess(toNum, z.number({ error: "الضمان الفني: يرجى إدخال عدد صحيح" }).int("الضمان الفني: عدد شهور صحيح").min(0).max(240).nullable()),
    stampEngineeringPct: pct("دمغة هندسية", 10),
    stampAppliedArtsPct: pct("دمغة فنون تطبيقية", 10),
    stampConstructionPct: pct("دمغة تشييد", 10),
    retentionPct: pct("تأمين الأعمال"),
    advancePct: pct("الدفعة المقدمة"),
    outOfScopeUplift: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().max(500, "علاوة خارج النطاق أطول من الحد المسموح").nullable()),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, { message: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء", path: ["endDate"] });

export type ContractEditInput = z.infer<typeof contractEditSchema>;
export type ContractEditField = keyof ContractEditInput;
