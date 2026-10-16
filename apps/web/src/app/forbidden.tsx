import { ShieldX } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";

// بيظهر لما الصفحة تنادي forbidden() (requireRole / requirePermission / requireNavAccess)
export default function Forbidden() {
  return (
    <div className="grid min-h-[60vh] place-items-center p-4">
      <EmptyState icon={ShieldX} title="لا تملك صلاحية الوصول إلى هذه الصفحة" action={<ButtonLink href="/" variant="pr">الرئيسية</ButtonLink>}>
        <div className="text-[13px]">هذه الصفحة خارج صلاحيات دورك الوظيفي. يرجى التواصل مع مدير النظام عند الحاجة.</div>
      </EmptyState>
    </div>
  );
}
