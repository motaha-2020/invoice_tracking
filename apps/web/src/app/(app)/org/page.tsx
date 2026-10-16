import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui";
import { OrgScreen } from "@/features/org/components/org-screen";

export const metadata: Metadata = { title: "الهيكل التنظيمي والمشروعات" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function OrgPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrgScreen tabParam={searchParams.then((p) => p.tab)} />
    </Suspense>
  );
}
