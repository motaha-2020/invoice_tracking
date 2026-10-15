import type { Metadata } from "next";
import { UnderConstruction } from "@/features/shell/components/under-construction";

export const metadata: Metadata = { title: "مستخلص جديد" };

export default function Page() {
  return <UnderConstruction navKey="inv-new" sub="تقديم مستخلص على أمر تكليف: البنود والمهمات والمرفقات" />;
}
