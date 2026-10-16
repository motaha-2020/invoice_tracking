import type { AoChangeKind, AoStatus } from "@it/db";
import type { Tone } from "@/lib/labels";

export const AO_STATUS: Record<AoStatus, { label: string; tone: Tone }> = {
  pending_approval: { label: "بانتظار الاعتماد", tone: "a" },
  active: { label: "سارٍ", tone: "g" },
  closed: { label: "مغلق", tone: "n" },
};

export const AO_CHANGE_KIND: Record<AoChangeKind, { label: string; tone: Tone }> = {
  increase: { label: "ملحق أمر التكليف", tone: "p" },
  commitment_renewal: { label: "تعزيز الارتباط المالي", tone: "b" },
};

/** أنواع مرفقات العقد — العمود kind في contract_attachments */
export const CONTRACT_DOC_KINDS = {
  award_letter: "برقية القبول",
  boq: "المقايسة / جدول الكميات",
  signed_contract: "العقد الموقّع",
  addendum: "ملحق / تعديل على العقد",
  guarantee: "خطاب الضمان",
  other: "مستند آخر",
} as const;

export type ContractDocKind = keyof typeof CONTRACT_DOC_KINDS;
export const isContractDocKind = (v: unknown): v is ContractDocKind => typeof v === "string" && v in CONTRACT_DOC_KINDS;
