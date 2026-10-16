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
