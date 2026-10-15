import type { Metadata } from "next";
import { UnderConstruction } from "@/features/shell/components/under-construction";

export const metadata: Metadata = { title: "الهيكل والمشاريع" };

export default function Page() {
  return <UnderConstruction navKey="org" sub="الرئاسات والقطاعات والإدارات والسنترالات والمشاريع" />;
}
