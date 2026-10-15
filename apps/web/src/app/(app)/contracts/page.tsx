import type { Metadata } from "next";
import { UnderConstruction } from "@/features/shell/components/under-construction";

export const metadata: Metadata = { title: "العقود وأوامر التكليف" };

export default function Page() {
  return <UnderConstruction navKey="contracts" sub="العقود والمقايسات وأوامر التكليف وملاحقها" />;
}
