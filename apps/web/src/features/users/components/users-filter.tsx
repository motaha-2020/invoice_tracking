import { Search } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/labels";
import { ALL_ROLES } from "../users.rules";
import type { UserFilter } from "../users.types";

/** فلتر بـ GET (في الرابط) — الصفحة server بتفلتر في DB، ومفيش JS محتاج */
export function UsersFilter({ filter, roleCounts }: { filter: UserFilter; roleCounts: Partial<Record<string, number>> }) {
  return (
    <form method="get" action="/users" className="flex flex-wrap items-center gap-2 border-b border-bd1 px-[18px] py-2.5 max-sm:px-3">
      <input type="hidden" name="tab" value="list" />
      <Input name="q" defaultValue={filter.q ?? ""} placeholder="البحث بالاسم أو البريد الإلكتروني…" aria-label="بحث في المستخدمين" className="max-w-[300px] flex-1" />
      <Select name="role" defaultValue={filter.role ?? ""} aria-label="الدور الوظيفي" className="w-auto">
        <option value="">جميع الأدوار</option>
        {ALL_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]} ({roleCounts[r] ?? 0})
          </option>
        ))}
      </Select>
      <Select name="active" defaultValue={filter.active ?? ""} aria-label="الحالة" className="w-auto">
        <option value="">جميع الحالات</option>
        <option value="1">نشط</option>
        <option value="0">موقوف</option>
      </Select>
      <Button type="submit">
        <Search aria-hidden /> بحث
      </Button>
    </form>
  );
}
