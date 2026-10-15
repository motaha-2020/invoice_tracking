import type { Metadata } from "next";
import { UnderConstruction } from "@/features/shell/components/under-construction";

export const metadata: Metadata = { title: "سجل الإيميلات" };

export default function Page() {
  return <UnderConstruction navKey="emails" sub="الإيميلات الصادرة وحالة الإرسال" />;
}
