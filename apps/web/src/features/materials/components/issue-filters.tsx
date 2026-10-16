import { Filter } from "lucide-react";
import Link from "next/link";
import { Button, Select } from "@/components/ui";

type Option = { id: string; label: string };

type Props = {
  tab: string;
  contracts: Option[];
  aos: (Option & { contractId: string })[];
  materials: Option[];
  value: { contractId?: string; aoId?: string; materialId?: string };
};

/** فلاتر المنصرف والمقارنة — فورم GET عادي (بيشتغل من غير JavaScript) */
export function IssueFilters({ tab, contracts, aos, materials, value }: Props) {
  const aoList = value.contractId ? aos.filter((a) => a.contractId === value.contractId) : aos;
  return (
    <form method="get" action="/materials" className="flex flex-wrap items-center gap-2 border-b border-bd1 px-[18px] py-2.5 max-sm:px-3">
      <input type="hidden" name="tab" value={tab} />
      <Select name="contract" defaultValue={value.contractId ?? ""} aria-label="العقد" className="w-auto min-w-[180px] flex-1">
        <option value="">جميع العقود</option>
        {contracts.map((c) => (
          <option key={c.id} value={c.id}>{c.label}</option>
        ))}
      </Select>
      <Select name="ao" defaultValue={value.aoId ?? ""} aria-label="أمر التكليف" className="w-auto min-w-[180px] flex-1">
        <option value="">جميع أوامر التكليف</option>
        {aoList.map((a) => (
          <option key={a.id} value={a.id}>{a.label}</option>
        ))}
      </Select>
      <Select name="material" defaultValue={value.materialId ?? ""} aria-label="الصنف" className="w-auto min-w-[180px] flex-1">
        <option value="">جميع الأصناف</option>
        {materials.map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </Select>
      <Button type="submit" size="sm">
        <Filter aria-hidden /> عرض
      </Button>
      {(value.contractId || value.aoId || value.materialId) && (
        <Link href={`/materials?tab=${tab}`} className="text-sm text-tx3">إلغاء التصفية</Link>
      )}
    </form>
  );
}
