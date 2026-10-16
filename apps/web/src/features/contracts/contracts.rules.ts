/**
 * قواعد العقود وأوامر التكليف — دوال صافية (من غير DB ولا Next) عشان تتختبر بـ vitest.
 * الـ importers والـ service بيستخدموها.
 */
import type { Prisma } from "@it/db";
import type { RoleScope } from "../auth/auth.types";

// ─────────────────────────── رقم أمر التكليف ───────────────────────────

const ARABIC_DIGITS = /[٠-٩]/g;
const latin = (s: string) => s.replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660));

/**
 * توحيد رقم أمر التكليف: "25" / "po 25" / "PO-25" / "٢٥" ← "PO25"، و"5" ← "PO05" (زي الخطابات).
 * أي شكل تاني (فيه حروف غير PO) بيرجع زي ما هو بعد التنضيف، و"" لو فاضي.
 */
export function normalizeAoNo(v: unknown): string {
  const t = latin(v == null ? "" : String(v)).replace(/[\s_\-./]+/g, "").toUpperCase();
  if (!t) return "";
  const m = /^(?:PO)?0*(\d+)$/.exec(t);
  if (!m) return t;
  return `PO${m[1]!.padStart(2, "0")}`;
}

// ─────────────────────────── شروط الدفع ───────────────────────────

export type PaymentTermsCheck = { ok: true; sum: number } | { ok: false; sum: number; message: string };

/** الصرف الشهري + محجوز As-Built + محجوز التسليم لازم = 100 بالظبط */
export function checkPaymentTerms(monthly: number | null, asbuilt: number | null, handover: number | null): PaymentTermsCheck {
  // بالقروش عشان 33.33 + 33.33 + 33.34 تطلع 100 من غير أخطاء floating
  const cents = [monthly, asbuilt, handover].reduce<number>((a, v) => a + Math.round((v ?? 0) * 100), 0);
  const sum = cents / 100;
  if (cents === 10000) return { ok: true, sum };
  return {
    ok: false,
    sum,
    message: `مجموع نسب السداد (الشهري ${monthly ?? 0}% + As-Built ${asbuilt ?? 0}% + الاستلام الابتدائي ${handover ?? 0}%) = ${sum}% — يجب أن يساوي 100%`,
  };
}

const pct = (n: number) => `${Number(n.toFixed(2))}%`;

/** ملخص الشروط للعرض: "70% / 20% As-Built / 10% تسليم" */
export function termsSummary(t: { payMonthlyPct: number; payAsbuiltPct: number; payHandoverPct: number }): string {
  const parts = [pct(t.payMonthlyPct)];
  if (t.payAsbuiltPct > 0) parts.push(`${pct(t.payAsbuiltPct)} As-Built`);
  if (t.payHandoverPct > 0) parts.push(`${pct(t.payHandoverPct)} استلام ابتدائي`);
  return parts.join(" / ");
}

// ─────────────────────────── تدرج المقايسة ───────────────────────────

/** الأب المباشر: "1-1-1-2" ← "1-1-1"، و"1" ← null */
export function parentOf(itemNo: string): string | null {
  const i = itemNo.lastIndexOf("-");
  return i > 0 ? itemNo.slice(0, i) : null;
}

/** المستوى (1 = باب رئيسي) — للمسافة في جدول المقايسة */
export function itemLevel(itemNo: string): number {
  return itemNo.replace(/^N-/i, "").split("-").length;
}

export type BoqRowRef = { row: number; itemNo: string };
export type BoqIssue = { errors: string[]; warnings: string[] };

/**
 * فحص التدرج: البند المتكرر = خطأ (التكرار التاني وما بعده)، والبند اللي أبوه مش موجود
 * لا في الملف ولا في المقايسة المسجلة = تحذير.
 * بيرجع Map بالصف ← المشاكل (الصفوف السليمة مش موجودة فيه).
 */
export function checkBoqHierarchy(rows: readonly BoqRowRef[], existing: ReadonlySet<string> = new Set()): Map<number, BoqIssue> {
  const out = new Map<number, BoqIssue>();
  const issue = (row: number) => {
    let x = out.get(row);
    if (!x) out.set(row, (x = { errors: [], warnings: [] }));
    return x;
  };
  const firstRow = new Map<string, number>();
  for (const r of rows) {
    const seen = firstRow.get(r.itemNo);
    if (seen != null) issue(r.row).errors.push(`البند ${r.itemNo} مكرر (ورد أول مرة في الصف ${seen})`);
    else firstRow.set(r.itemNo, r.row);
  }
  for (const r of rows) {
    const p = parentOf(r.itemNo);
    if (p && p.toUpperCase() !== "N" && !firstRow.has(p) && !existing.has(p)) {
      issue(r.row).warnings.push(`البند الرئيسي ${p} غير موجود في جدول الكميات`);
    }
  }
  return out;
}

// ─────────────────────────── ملاحق أمر التكليف ───────────────────────────

/**
 * كميات الملحق في الملف: زيادة على المخطط (add) ولا الإجمالي الجديد بعد الزيادة (replace)؟
 * بنقارن قيمة الكميات × أسعار العقد بقيمة الزيادة وبالقيمة الجديدة، والأقرب يكسب.
 * لو مفيش أرقام نقارن بيها: add (زي الديمو).
 */
export function addendumMode(fileValue: number, increase: number | null, newTotal: number | null): "add" | "replace" {
  if (fileValue <= 0) return "add";
  const dist = (target: number | null) => (target && target > 0 ? Math.abs(fileValue - target) / target : Infinity);
  const dAdd = dist(increase);
  const dRep = dist(newTotal);
  if (dAdd === Infinity && dRep === Infinity) return "add";
  return dRep < dAdd ? "replace" : "add";
}

// ─────────────────────────── النطاق ───────────────────────────

/**
 * العقود مش سرية جوه الشركة المصرية للاتصالات، فأي دور داخلي يشوف الكل.
 * مستخدم الشركة بس (كل أدواره company) بيشوف عقود شركته/شركاته.
 */
export function contractsScopeWhere(user: { roles: readonly RoleScope[] }): Prisma.ContractWhereInput {
  if (user.roles.length === 0) return { id: { in: [] } };
  if (user.roles.some((r) => r.role !== "company")) return {};
  const ids = user.roles.filter((r) => r.scopeType === "company" && r.scopeId).map((r) => r.scopeId!);
  return { companyId: { in: [...new Set(ids)] } };
}
