/**
 * نطاق أوامر التكليف — مبني من scopeWhere (المصدر الوحيد للنطاق) عن طريق تحويل شرط المستخلص لشرط أمر التكليف:
 *   { ao: X } ← X ،  { contract: Y } ← { contract: Y } ،  OR / AND بيتحوّلوا عنصر عنصر.
 * أي مفتاح مش متوقع ← DENY (أأمن من إننا نفتح بيانات بالغلط). دوال صافية عشان تتختبر.
 */
import type { Prisma } from "@it/db";
import type { SessionUser } from "../auth/auth.types";
import { scopeWhere } from "../auth/scope";

type AoWhere = Prisma.AssignmentOrderWhereInput;

export const AO_DENY_ALL: AoWhere = { id: { in: [] } };

export function invoiceWhereToAoWhere(w: Prisma.InvoiceWhereInput): AoWhere {
  const keys = Object.keys(w) as (keyof Prisma.InvoiceWhereInput)[];
  if (keys.length === 0) return {};
  const parts: AoWhere[] = [];
  for (const k of keys) {
    const v = w[k];
    switch (k) {
      case "OR":
        parts.push({ OR: (v as Prisma.InvoiceWhereInput[]).map(invoiceWhereToAoWhere) });
        break;
      case "AND": {
        const list = Array.isArray(v) ? v : [v as Prisma.InvoiceWhereInput];
        parts.push({ AND: list.map(invoiceWhereToAoWhere) });
        break;
      }
      case "ao":
        parts.push(v as AoWhere);
        break;
      case "contract":
        parts.push({ contract: v as Prisma.ContractScalarRelationFilter });
        break;
      // DENY_ALL بتاع المستخلصات (id in []) أو أي حاجة تانية ← مفيش صلاحية
      default:
        return AO_DENY_ALL;
    }
  }
  return parts.length === 1 ? parts[0]! : { AND: parts };
}

/** أوامر التكليف اللي في نطاق المستخدم */
export function aoScopeWhere(user: Pick<SessionUser, "roles">): AoWhere {
  return invoiceWhereToAoWhere(scopeWhere(user));
}

/** هل النطاق مفتوح (all)؟ */
export function isUnscoped(w: AoWhere): boolean {
  return Object.keys(w).length === 0;
}
