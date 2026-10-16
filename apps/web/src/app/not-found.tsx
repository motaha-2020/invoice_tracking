import { SearchX } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <EmptyState icon={SearchX} title="الصفحة غير موجودة" action={<ButtonLink href="/" variant="pr">الرئيسية</ButtonLink>}>
        <div className="text-[13px]">ربما يكون الرابط غير صحيح أو نُقلت الصفحة.</div>
      </EmptyState>
    </div>
  );
}
