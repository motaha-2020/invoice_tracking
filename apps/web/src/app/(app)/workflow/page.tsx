import type { Metadata } from "next";
import { UnderConstruction } from "@/features/shell/components/under-construction";

export const metadata: Metadata = { title: "المسار والـ SLA" };

export default function Page() {
  return <UnderConstruction navKey="workflow" sub="المحطات وفئات التجاوز والـ SLA" />;
}
