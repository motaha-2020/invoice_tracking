import type { Metadata } from "next";
import { UnderConstruction } from "@/features/shell/components/under-construction";

export const metadata: Metadata = { title: "التقارير والتصدير" };

export default function Page() {
  return <UnderConstruction navKey="reports" sub="تقارير المستخلصات والمدد المستهدفة (SLA) والتصدير إلى Excel" />;
}
