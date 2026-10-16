import type { AoChangeKind, AoStatus } from "@it/db";
import type { Tone } from "@/lib/labels";

export const AO_STATUS: Record<AoStatus, { label: string; tone: Tone }> = {
  pending_approval: { label: "بانتظار الاعتماد", tone: "a" },
  active: { label: "ساري", tone: "g" },
  closed: { label: "مقفول", tone: "n" },
};

export const AO_CHANGE_KIND: Record<AoChangeKind, { label: string; tone: Tone }> = {
  increase: { label: "ملحق زيادة", tone: "p" },
  commitment_renewal: { label: "تجديد التزام مالي", tone: "b" },
};
