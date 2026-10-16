/**
 * ترحيل المستخلصات (قالب 11): ترجمة "المحطة الحالية" العربي لحالة + محطة، واستنتاج نوع المستخلص — دوال صافية.
 */
import type { InvoiceKind, InvoiceStatus } from "@it/db";

export type MigratedState = {
  status: InvoiceStatus;
  currentStep: string | null;
  heldAt: string | null;
  holdReason: string | null;
};

export const HOLD_REASON_AO = "بانتظار أمر التكليف";

/** توحيد الكتابة العربي عشان المقارنة: همزات، تاء مربوطة، ياء، تشكيل، مسافات */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, "") // تشكيل + تطويل
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ؤئ]/g, "ء")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\s\-_/.]+/g, "")
    .trim();
}

const active = (step: string): MigratedState => ({ status: "active", currentStep: step, heldAt: null, holdReason: null });

/** القائمة اللي في القالب + أسماء بديلة شائعة في ملفات الموقف */
const STEP_NAMES: [string[], MigratedState][] = [
  [["الشركة", "الشركة المنفذة", "المقاول"], { status: "draft", currentStep: null, heldAt: null, holdReason: null }],
  [["مشرف التنفيذ", "المشرف", "مشرف"], active("sup")],
  [["مدير التنفيذ", "إدارة التنفيذ", "ادارة التنفيذ", "التنفيذ"], active("exec")],
  [["المدير العام", "مدير عام", "الإدارة العامة"], active("gm")],
  [["الشئون الفنية", "الشؤون الفنية", "الفنية"], active("tech")],
  [["التخطيط"], active("plan")],
  [["رئاسة القطاعات", "رئيس رئاسة القطاعات"], active("pres")],
  [["اللجنة العليا", "اللجنة"], active("committee")],
  [["التسعير"], active("pricing")],
  [["رئيس القطاع", "القطاع"], active("sector")],
  [["المخازن والمشتريات", "المخازن", "المشتريات"], active("stores")],
  [["المالية", "الحسابات"], active("finance")],
  [["تم الصرف", "مصروف", "اتصرف", "صرف"], { status: "paid", currentStep: null, heldAt: null, holdReason: null }],
  [[HOLD_REASON_AO, "معلق", "معلّق"], { status: "on_hold", currentStep: "sup", heldAt: "sup", holdReason: HOLD_REASON_AO }],
];

const LOOKUP = new Map<string, MigratedState>(
  STEP_NAMES.flatMap(([names, state]) => names.map((n) => [normalizeArabic(n), state] as const)),
);

/** المحطة الحالية ← الحالة. null = اسم مش معروف (الـ importer بيحطه جاري عند المشرف مع تحذير) */
export function mapStepName(name: string): MigratedState | null {
  const st = LOOKUP.get(normalizeArabic(name));
  return st ? { ...st } : null;
}

/** الحالة الافتراضية لمحطة مش معروفة */
export const UNKNOWN_STEP_STATE: MigratedState = active("sup");

/** نوع المستخلص من اسم المسار: كهربي ← electrical، تخطيط ← planning، غير كده مدني */
export function inferInvoiceKind(pathName: string): InvoiceKind {
  const t = normalizeArabic(pathName);
  if (t.includes("كهرب")) return "electrical";
  if (t.includes("تخطيط")) return "planning";
  return "civil";
}
