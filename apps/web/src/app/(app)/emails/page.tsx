import type { Metadata } from "next";
import { UnderConstruction } from "@/features/shell/components/under-construction";

export const metadata: Metadata = { title: "سجل البريد الإلكتروني" };

export default function Page() {
  return <UnderConstruction navKey="emails" sub="رسائل البريد الإلكتروني الصادرة وحالة الإرسال" />;
}
