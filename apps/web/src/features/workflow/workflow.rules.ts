/**
 * قواعد شاشة المسار والإعدادات — دوال صافية (من غير DB ولا Next) عشان تتختبر بـ vitest.
 */
import { CATEGORY_STEP } from "@it/domain";

export type StepMeta = { key: string; name: string; short: string; role: string; sort: number };

/** خانات فئة واحدة في المصفوفة: المفتاح موجود = المحطة في المسار، والقيمة = SLA (null = من غير SLA) */
export type CategoryCells = Record<string, number | null>;
export type SlaMatrix = Record<string, CategoryCells>;

export type CategoryStepRow = { categoryCode: string; stepKey: string; seq: number; slaDays: number | null };

export const MAX_SLA_DAYS = 60;
export const DEFAULT_NEW_SLA = 2;
/** محطة الشركة مش جزء من المسار (التقديم نفسه) */
export const NON_PATH_STEPS = new Set(["company"]);

type Result<T> = { value: T; error?: undefined } | { value?: undefined; error: string };

/** المحطات اللي تظهر كصفوف في المصفوفة، بترتيب WorkflowStep.sort */
export function pathSteps(steps: readonly StepMeta[]): StepMeta[] {
  return steps.filter((s) => !NON_PATH_STEPS.has(s.key)).sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key));
}

/** صفوف category_steps الحالية ← خانات */
export function cellsFromRows(rows: readonly { stepKey: string; slaDays: number | null }[]): CategoryCells {
  return Object.fromEntries(rows.map((r) => [r.stepKey, r.slaDays]));
}

/** تشغيل/إيقاف محطة. التشغيل بيحط SLA افتراضي — والترتيب نفسه بييجي من sort وقت التحويل. */
export function toggleCell(cells: CategoryCells, stepKey: string, on: boolean): CategoryCells {
  if (on) return stepKey in cells ? cells : { ...cells, [stepKey]: DEFAULT_NEW_SLA };
  return Object.fromEntries(Object.entries(cells).filter(([k]) => k !== stepKey));
}

/** قيمة خانة الـ SLA من الإدخال: فاضي = null، غير كده عدد صحيح 0..60 */
export function parseSla(v: string): Result<number | null> {
  const t = v.trim();
  if (!t) return { value: null };
  const n = Number(t.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)));
  if (!Number.isInteger(n) || n < 0 || n > MAX_SLA_DAYS) return { error: `الـ SLA لازم عدد أيام صحيح من 0 لـ ${MAX_SLA_DAYS}` };
  return { value: n };
}

export function totalSla(cells: CategoryCells): number {
  return Object.values(cells).reduce<number>((a, v) => a + (v ?? 0), 0);
}

/** المسار مترتّب (للمعاينة والحفظ) */
export function orderedPath(cells: CategoryCells, steps: readonly StepMeta[]): { stepKey: string; slaDays: number | null }[] {
  return pathSteps(steps)
    .filter((s) => s.key in cells)
    .map((s) => ({ stepKey: s.key, slaDays: cells[s.key] ?? null }));
}

/**
 * التحقق من مسار فئة: محطة واحدة على الأقل، محطات معروفة بس، SLA سليم،
 * محطة تحديد الفئة (exec) لازم تبقى موجودة، والمسار بيخلص بالمالية.
 */
export function validateCells(category: string, cells: CategoryCells, steps: readonly StepMeta[]): string | null {
  const known = new Set(pathSteps(steps).map((s) => s.key));
  const keys = Object.keys(cells);
  if (keys.length === 0) return `مسار ${category} فاضي — لازم محطة واحدة على الأقل`;
  const unknown = keys.find((k) => !known.has(k));
  if (unknown) return `المحطة "${unknown}" مش معروفة أو مينفعش تبقى في المسار`;
  for (const k of keys) {
    const v = cells[k];
    if (v != null && (!Number.isInteger(v) || v < 0 || v > MAX_SLA_DAYS)) return `SLA غلط في ${category}`;
  }
  if (known.has(CATEGORY_STEP) && !(CATEGORY_STEP in cells)) {
    const name = steps.find((s) => s.key === CATEGORY_STEP)?.short ?? CATEGORY_STEP;
    return `مسار ${category} لازم يعدّي على "${name}" (هي اللي بتحدد الفئة)`;
  }
  const path = orderedPath(cells, steps);
  if (known.has("finance") && path[path.length - 1]?.stepKey !== "finance") return `مسار ${category} لازم يخلص بالمالية`;
  return null;
}

/** خانات فئة ← صفوف category_steps (seq من 1 بترتيب WorkflowStep.sort) */
export function matrixToCategorySteps(category: string, cells: CategoryCells, steps: readonly StepMeta[]): CategoryStepRow[] {
  return orderedPath(cells, steps).map((p, i) => ({ categoryCode: category, stepKey: p.stepKey, seq: i + 1, slaDays: p.slaDays }));
}

/** المحطات اللي اتشالت من المسار (عشان نتأكد إن مفيش مستخلصات واقفة عليها) */
export function removedSteps(before: CategoryCells, after: CategoryCells): string[] {
  return Object.keys(before).filter((k) => !(k in after));
}

export function sameCells(a: CategoryCells, b: CategoryCells): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => k in b && a[k] === b[k]);
}

// ── الإعدادات ───────────────────────────────────────────

export const WEEK_DAYS = [
  ["sun", "الأحد"],
  ["mon", "الاتنين"],
  ["tue", "التلات"],
  ["wed", "الأربع"],
  ["thu", "الخميس"],
  ["fri", "الجمعة"],
  ["sat", "السبت"],
] as const;
export type WeekDay = (typeof WEEK_DAYS)[number][0];

export type EditableSettings = { slaWarnAt: number; dailyDigestAt: string; weeklyReportDay: WeekDay };

export const SETTING_DEFAULTS: EditableSettings = { slaWarnAt: 1, dailyDigestAt: "08:00", weeklyReportDay: "sun" };

/** قيم Setting (Json) ← إعدادات مكتوبة، والقيم الغلط بترجع للافتراضي */
export function readSettings(raw: Record<string, unknown>): EditableSettings {
  const warn = Number(raw.slaWarnAt);
  const at = typeof raw.dailyDigestAt === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.dailyDigestAt) ? raw.dailyDigestAt : SETTING_DEFAULTS.dailyDigestAt;
  const day = WEEK_DAYS.some(([k]) => k === raw.weeklyReportDay) ? (raw.weeklyReportDay as WeekDay) : SETTING_DEFAULTS.weeklyReportDay;
  return { slaWarnAt: Number.isInteger(warn) && warn >= 0 && warn <= 10 ? warn : SETTING_DEFAULTS.slaWarnAt, dailyDigestAt: at, weeklyReportDay: day };
}
