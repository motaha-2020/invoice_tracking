import type { Metadata } from "next";
import { UnderConstruction } from "@/features/shell/components/under-construction";

export const metadata: Metadata = { title: "المستخدمين والصلاحيات" };

export default function Page() {
  return <UnderConstruction navKey="users" sub="الحسابات والأدوار والنطاقات والدعوات" />;
}
