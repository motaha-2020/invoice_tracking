import type { StatusColor } from './types';

/*
 * مقارنة المهمات: مخطط (أمر التكليف) / منصرف (المخازن) / منفذ سابق / منفذ في المستخلص ده.
 */

export interface MaterialInput {
  code: string;
  /** كمية أمر التكليف (0 = مش في أمر التكليف) */
  planned: number;
  /** إجمالي المنصرف من المخازن على أمر التكليف */
  issued: number;
  /** المنفذ (المفوتر) في المستخلصات السابقة */
  prevExecuted: number;
  /** المنفذ في المستخلص ده */
  executed: number;
  /** المفوتر لو مختلف عن المنفذ */
  billed?: number | null;
}

export type MaterialFlagCode = 'not_in_ao' | 'exceeds_issued' | 'unused_issued' | 'exceeds_planned';

export interface MaterialFlag {
  code: MaterialFlagCode;
  cls: Extract<StatusColor, 'r' | 'a'>;
  text: string;
}

export interface MaterialComparison extends MaterialInput {
  billed: number;
  cumExecuted: number;
  /** المنصرف − المنفذ التراكمي (سالب = اتنفذ أكتر من المنصرف) */
  balance: number;
  flags: MaterialFlag[];
}

export interface MaterialOptions {
  /** رصيد منصرف لم يُستخدم: لو الرصيد أكبر من max(minUnused, issued × unusedRatio) */
  minUnused: number;
  unusedRatio: number;
}

export const DEFAULT_MATERIAL_OPTIONS: Readonly<MaterialOptions> = { minUnused: 5, unusedRatio: 0.15 };

const EPS = 1e-9;
const roundQty = (n: number): number => Math.round(n * 10_000) / 10_000;

function flagsFor(m: MaterialInput, cum: number, opts: MaterialOptions): MaterialFlag[] {
  const flags: MaterialFlag[] = [];
  if (!m.planned) flags.push({ code: 'not_in_ao', cls: 'r', text: 'غير موجود في أمر التكليف' });
  if (cum > m.issued + EPS) {
    flags.push({ code: 'exceeds_issued', cls: 'r', text: 'المنفذ التراكمي أكبر من المنصرف' });
  } else if (m.issued - cum > Math.max(opts.minUnused, m.issued * opts.unusedRatio)) {
    flags.push({ code: 'unused_issued', cls: 'a', text: 'رصيد منصرف لم يُستخدم' });
  }
  if (m.planned && cum > m.planned + EPS) flags.push({ code: 'exceeds_planned', cls: 'a', text: 'المنفذ أكبر من المخطط' });
  return flags;
}

/** يقارن مهمة واحدة ويطلّع التراكمي والرصيد والتنبيهات. */
export function compareMaterial(m: MaterialInput, opts: MaterialOptions = DEFAULT_MATERIAL_OPTIONS): MaterialComparison {
  const cumExecuted = roundQty(m.prevExecuted + m.executed);
  return {
    ...m,
    billed: m.billed ?? m.executed,
    cumExecuted,
    balance: roundQty(m.issued - cumExecuted),
    flags: flagsFor(m, cumExecuted, opts),
  };
}

/** يقارن كل مهمات المستخلص. */
export function compareMaterials(items: readonly MaterialInput[], opts: MaterialOptions = DEFAULT_MATERIAL_OPTIONS): MaterialComparison[] {
  return items.map((m) => compareMaterial(m, opts));
}
