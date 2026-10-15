import { SearchX } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <EmptyState icon={SearchX} title="الصفحة دي مش موجودة" action={<ButtonLink href="/" variant="pr">الرئيسية</ButtonLink>}>
        <div className="text-[13px]">يمكن الرابط غلط أو الصفحة اتنقلت.</div>
      </EmptyState>
    </div>
  );
}
