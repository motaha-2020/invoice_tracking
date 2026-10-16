import type { StatusColor } from './types';

/*
 * التحقق من بنود ومهمات المستخلص اللي المقاول بيرفعها (Excel أو إدخال يدوي).
 * نفس الدالة بتشتغل في المتصفح (معاينة فورية) وفي السيرفر (قبل الحفظ).
 */

const ARABIC_DIGITS = /[٠-٩]/g;
const latin = (s: string): string => s.replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660));

/** توحيد رقم البند (زي استيراد المقايسة): "1.1.2" / " 1-1-2 " / "١-١-٢" ← "1-1-2"، و"n-3" ← "N-3" */
export function normItemCode(v: unknown): string {
  return latin(v == null ? '' : String(v)).replace(/\s+/g, '').replace(/\./g, '-').toUpperCase();
}

/** توحيد كود الموقع / الصنف: مسافات وأرقام عربية */
export function normCode(v: unknown): string {
  return latin(v == null ? '' : String(v)).trim().replace(/\s+/g, ' ');
}

/** رقم من خانة Excel أو إدخال: "1,250.5" / "١٢٥" ← number، والفاضي ← NaN */
export function parseQty(v: unknown): number {
  if (typeof v === 'number') return v;
  const t = latin(v == null ? '' : String(v)).trim().replace(/,/g, '').replace(/٫/g, '.');
  return t === '' ? Number.NaN : Number(t);
}

export interface RowMsg {
  cls: Extract<StatusColor, 'r' | 'a'>;
  text: string;
}

export type RowLevel = 'ok' | 'warn' | 'err' | 'skip';

// ─────────────────────────── البنود ───────────────────────────

export interface LineRowInput {
  code: unknown;
  qty: unknown;
  site?: unknown;
  /** صف من الإدخال اليدوي (الكمية الفاضية = البند مش في المستخلص، مش خطأ) */
  manual?: boolean;
}

export interface ContractItemRef {
  id: string;
  isGroup: boolean;
  unitPrice: number | null;
}

export interface LineCheckContext {
  /** بنود العقد بالرقم الموحد */
  items: ReadonlyMap<string, ContractItemRef>;
  /** بنود العقد اللي ليها كميات في أمر التكليف */
  aoItemIds: ReadonlySet<string>;
  /** أكواد مواقع أمر التكليف */
  sites: ReadonlySet<string>;
  /** الموقع الافتراضي للصفوف اللي من غير موقع */
  defaultSite?: string | null;
}

export interface LineRowCheck {
  i: number;
  code: string;
  qty: number;
  site: string | null;
  level: RowLevel;
  msgs: RowMsg[];
  contractItemId: string | null;
  /** الصف اتجمع مع صف قبله (نفس البند والموقع) */
  merged: boolean;
}

export interface CheckedLine {
  contractItemId: string;
  qty: number;
  siteCode: string | null;
}

export interface LineCheckResult {
  rows: LineRowCheck[];
  lines: CheckedLine[];
  err: number;
  warn: number;
}

const roundQty = (n: number): number => Math.round(n * 10_000) / 10_000;

/** يتحقق من صفوف البنود ويطلّع البنود النهائية (المكرر لنفس البند والموقع بيتجمع). */
export function checkLineRows(rows: readonly LineRowInput[], ctx: LineCheckContext): LineCheckResult {
  const out: LineCheckResult = { rows: [], lines: [], err: 0, warn: 0 };
  const first = new Map<string, number>();
  rows.forEach((r, i) => {
    const code = normItemCode(r.code);
    const qty = parseQty(r.qty);
    const site = normCode(r.site) || ctx.defaultSite || null;
    const it = ctx.items.get(code);
    const res: LineRowCheck = { i, code, qty, site, level: 'ok', msgs: [], contractItemId: it?.id ?? null, merged: false };
    if (r.manual && !(qty > 0)) {
      res.level = 'skip';
      out.rows.push(res);
      return;
    }
    if (!it) res.msgs.push({ cls: 'r', text: 'رقم البند غير موجود في جدول كميات العقد' });
    else if (it.isGroup) res.msgs.push({ cls: 'r', text: 'هذا عنوان مجموعة وليس بنداً' });
    if (!(qty > 0)) res.msgs.push({ cls: 'r', text: 'يجب أن تكون الكمية رقماً أكبر من صفر' });
    if (res.msgs.length || !it) {
      res.level = 'err';
      out.err++;
      out.rows.push(res);
      return;
    }
    if (it.unitPrice == null) res.msgs.push({ cls: 'a', text: 'البند غير مُسعّر في التعاقد — سيُصنّف المستخلص C5' });
    if (!ctx.aoItemIds.has(it.id)) res.msgs.push({ cls: 'a', text: 'البند غير مدرج في أمر التكليف' });
    if (site && ctx.sites.size && !ctx.sites.has(site)) res.msgs.push({ cls: 'a', text: 'الموقع غير مدرج في مواقع أمر التكليف' });
    const key = `${it.id}|${site ?? ''}`;
    const at = first.get(key);
    if (at != null) {
      res.msgs.push({ cls: 'a', text: 'صف مكرر — جُمعت كميته مع الصف الأول لنفس البند والموقع' });
      res.merged = true;
      out.lines[at]!.qty = roundQty(out.lines[at]!.qty + qty);
    } else {
      first.set(key, out.lines.length);
      out.lines.push({ contractItemId: it.id, qty: roundQty(qty), siteCode: site });
    }
    if (res.msgs.length) {
      res.level = 'warn';
      out.warn++;
    }
    out.rows.push(res);
  });
  return out;
}

// ─────────────────────────── المهمات ───────────────────────────

export interface MaterialRowInput {
  code: unknown;
  qty: unknown;
}

export interface MaterialRowCheck {
  i: number;
  code: string;
  qty: number;
  level: RowLevel;
  msgs: RowMsg[];
  materialId: string | null;
  merged: boolean;
}

export interface CheckedMaterial {
  materialId: string;
  code: string;
  executedQty: number;
}

export interface MaterialCheckResult {
  rows: MaterialRowCheck[];
  mats: CheckedMaterial[];
  err: number;
  warn: number;
}

/** يتحقق من صفوف المهمات المنفذة مقابل الكتالوج (code ← id). */
export function checkMaterialRows(rows: readonly MaterialRowInput[], catalog: ReadonlyMap<string, string>): MaterialCheckResult {
  const out: MaterialCheckResult = { rows: [], mats: [], err: 0, warn: 0 };
  const first = new Map<string, number>();
  rows.forEach((r, i) => {
    const code = normCode(r.code);
    const qty = parseQty(r.qty);
    const id = catalog.get(code) ?? null;
    const res: MaterialRowCheck = { i, code, qty, level: 'ok', msgs: [], materialId: id, merged: false };
    if (!id) res.msgs.push({ cls: 'r', text: 'رقم الشطب غير موجود في كتالوج المهمات' });
    if (!(qty > 0)) res.msgs.push({ cls: 'r', text: 'يجب أن تكون الكمية رقماً أكبر من صفر' });
    if (res.msgs.length || !id) {
      res.level = 'err';
      out.err++;
      out.rows.push(res);
      return;
    }
    const at = first.get(id);
    if (at != null) {
      res.msgs.push({ cls: 'a', text: 'صف مكرر — جُمعت كميته مع الصف الأول' });
      res.merged = true;
      res.level = 'warn';
      out.warn++;
      out.mats[at]!.executedQty = roundQty(out.mats[at]!.executedQty + qty);
    } else {
      first.set(id, out.mats.length);
      out.mats.push({ materialId: id, code, executedQty: roundQty(qty) });
    }
    out.rows.push(res);
  });
  return out;
}
