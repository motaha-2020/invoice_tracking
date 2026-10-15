import { Construction } from "lucide-react";
import { Suspense } from "react";
import { ButtonLink, Card, EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { findNavItem } from "../nav";
import { requireNavAccess } from "../nav.service";

/**
 * صفحة لسه بتتبني — بس بتتحقق من الصلاحية بنفس قاعدة القائمة (ممنوع حد يدخلها بالرابط).
 */
export function UnderConstruction({ navKey, sub }: { navKey: string; sub?: string }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Guarded navKey={navKey} sub={sub} />
    </Suspense>
  );
}

async function Guarded({ navKey, sub }: { navKey: string; sub?: string }) {
  await requireNavAccess(navKey);
  const title = findNavItem(navKey)?.label ?? "";
  return (
    <>
      <PageHeader title={title} sub={sub} crumbs={[{ label: "الرئيسية", href: "/" }, { label: title }]} />
      <Card>
        <EmptyState icon={Construction} title="قيد البناء" action={<ButtonLink href="/">رجوع للرئيسية</ButtonLink>}>
          <div className="text-[13px]">الصفحة دي لسه بتتبني وهتبقى جاهزة قريب.</div>
        </EmptyState>
      </Card>
    </>
  );
}
