/**
 * ترحيل المستخلصات (قالب 11): ترجمة "المحطة الحالية" العربي لحالة + محطة، واستنتاج نوع الأعمال — دوال صافية.
 */
import type { InvoiceStatus } from "@it/db";
import { CATEGORY_CODES, CATEGORY_STEP, type CategoryCode, type WorkflowConfig } from "@it/domain";

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
  [["مشرف التنفيذ", "المشرف", "مشرف", "مراجعة مشرف التنفيذ"], active("sup")],
  [["مدير التنفيذ", "إدارة التنفيذ", "ادارة التنفيذ", "التنفيذ"], active("exec")],
  [["المدير العام", "مدير عام", "الإدارة العامة"], active("gm")],
  [["الشئون الفنية", "الشؤون الفنية", "الفنية"], active("tech")],
  [["التخطيط", "مراجعة التخطيط"], active("plan")],
  [["رئاسة القطاعات", "رئيس رئاسة القطاعات"], active("pres")],
  [["اللجنة العليا", "اللجنة"], active("committee")],
  [["التسعير"], active("pricing")],
  [["رئيس القطاع", "القطاع"], active("sector")],
  [["المخازن والمشتريات", "المخازن", "المشتريات"], active("stores")],
  [["المالية", "الإدارة المالية", "الحسابات"], active("finance")],
  [["تم السداد", "مسدد", "تم الصرف", "مصروف", "اتصرف", "صرف"], { status: "paid", currentStep: null, heldAt: null, holdReason: null }],
  [[HOLD_REASON_AO, "موقوف مؤقتاً", "معلق", "معلّق"], { status: "on_hold", currentStep: "sup", heldAt: "sup", holdReason: HOLD_REASON_AO }],
];

const LOOKUP = new Map<string, MigratedState>(
  STEP_NAMES.flatMap(([names, state]) => names.map((n) => [normalizeArabic(n), state] as const)),
);

/**
 * عبارات ملفات الموقف الحرّة (فيها أسماء الأشخاص)، زي "جارى التوقيع من مدير الإدارة (م/ ...)".
 * بتتقارن بعد normalizeArabic (من غير مسافات)، والترتيب مهم: أول كلمة تطابق بتكسب.
 */
const PHRASES: [keywords: string[], state: MigratedState][] = [
  [["منصرف", "تمالصرف", "مصروف"], { status: "paid", currentStep: null, heldAt: null, holdReason: null }],
  // لسه عند المقاول (بيتجهز أو بيتقاس) — مسودة
  [["تحتاليد", "تحتالقياس", "تقديري"], { status: "draft", currentStep: null, heldAt: null, holdReason: null }],
  [["مخازن"], active("stores")],
  [["فنيه"], active("tech")],
  [["ماليه", "حسابات"], active("finance")],
  [["مديرعام"], active("gm")],
  [["مديراداره", "مديرالاداره", "مديرالتنفيذ"], active("exec")],
  // مشرف التنفيذ، وتوقيع الشهادات، والمستخلص اللي اتسلّم وجاري اعتماده
  [["مشرف", "شهاده", "شهادات", "جاريالاعتماد", "تسليمفاتوره"], active("sup")],
];
const HOLD_PHRASES = ["انتظاراعتمادامرالتكليف", "انتظارامرالتكليف"];

function matchPhrase(t: string): MigratedState | null {
  return PHRASES.find(([keys]) => keys.some((k) => t.includes(k)))?.[1] ?? null;
}

/** المحطة الحالية ← الحالة. null = اسم مش معروف (الـ importer بيحطه جاري عند المشرف مع تحذير) */
export function mapStepName(name: string): MigratedState | null {
  const t = normalizeArabic(name);
  const exact = LOOKUP.get(t);
  if (exact) return { ...exact };
  // "بانتظار اعتماد أمر التكليف" ← موقوف مؤقتاً، عند المرحلة المذكورة معاه لو فيه (غير كده المشرف)
  if (HOLD_PHRASES.some((k) => t.includes(k))) {
    const at = matchPhrase(HOLD_PHRASES.reduce((s, k) => s.replace(k, ""), t));
    const step = at?.status === "active" ? at.currentStep! : "sup";
    return { status: "on_hold", currentStep: step, heldAt: step, holdReason: HOLD_REASON_AO };
  }
  const st = matchPhrase(t);
  return st ? { ...st } : null;
}

/**
 * فئة التجاوز للمستخلص المرحّل: المستخلص اللي عدّى مرحلة تحديد الفئة (أو اتصرف) لازم يكون ليه فئة
 * عشان المسار يترسم ويكمل صح. بنختار أول فئة (C1 ← C5) مسارها فيه المرحلة الحالية.
 * null = لسه قبل/عند مرحلة تحديد الفئة — مدير التنفيذ هو اللي يحددها.
 */
export function migratedCategory(config: WorkflowConfig, state: MigratedState): CategoryCode | null {
  if (state.status === "paid") return CATEGORY_CODES[0]!;
  const step = state.heldAt ?? state.currentStep;
  if (!step || state.status === "draft") return null;
  const first = config.categories[CATEGORY_CODES[0]!];
  const ci = first?.path.findIndex((p) => p.step === CATEGORY_STEP) ?? -1;
  const si = first?.path.findIndex((p) => p.step === step) ?? -1;
  if (si >= 0 && si <= ci) return null;
  return CATEGORY_CODES.find((c) => config.categories[c]?.path.some((p) => p.step === step)) ?? null;
}

/** الحالة الافتراضية لمحطة مش معروفة */
export const UNKNOWN_STEP_STATE: MigratedState = active("sup");

/** كلمة في اسم المسار ← كود نوع الأعمال (من seed المرجعي). الترتيب مهم: أول كلمة تطابق بتكسب */
const WORK_TYPE_KEYWORDS: [keyword: string, code: string][] = [
  ["كهرب", "ELECTRICAL"],
  ["تخطيط", "PLANNING"],
  ["صيانه", "CIVIL_MAINT"],
  ["متكامل", "INTEGRATED"],
];
export const DEFAULT_WORK_TYPE_CODE = "CIVIL";

/** كود نوع الأعمال من اسم المسار: كهرب ← ELECTRICAL، تخطيط ← PLANNING، صيانة ← CIVIL_MAINT، متكامل ← INTEGRATED، غير كده CIVIL */
export function inferWorkTypeCode(pathName: string): string {
  const t = normalizeArabic(pathName);
  return WORK_TYPE_KEYWORDS.find(([k]) => t.includes(k))?.[1] ?? DEFAULT_WORK_TYPE_CODE;
}
