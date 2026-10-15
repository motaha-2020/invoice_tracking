import { ShieldX } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";

// بيظهر لما الصفحة تنادي forbidden() (requireRole / requirePermission / requireNavAccess)
export default function Forbidden() {
  return (
    <div className="grid min-h-[60vh] place-items-center p-4">
      <EmptyState icon={ShieldX} title="مش مسموح لك تفتح الصفحة دي" action={<ButtonLink href="/" variant="pr">الرئيسية</ButtonLink>}>
        <div className="text-[13px]">الصفحة دي خارج صلاحيات دورك. لو محتاجها كلّم مدير النظام.</div>
      </EmptyState>
    </div>
  );
}
