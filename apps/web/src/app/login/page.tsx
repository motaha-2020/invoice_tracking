import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentUser } from "@/features/auth/session";

export const metadata: Metadata = { title: "تسجيل الدخول" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AuthLayout>
      <h2 className="m-0 mb-1 text-[22px] font-bold">تسجيل الدخول</h2>
      <p className="m-0 mb-5 text-tx3">يرجى تسجيل الدخول باستخدام البريد الإلكتروني وكلمة المرور.</p>
      {/* الفورم نفسه شغال من غير ما يستنى الجلسة؛ الـ next و التحويل لو داخل بيجوا من الـ request */}
      <Suspense fallback={<LoginForm />}>
        <LoginWithParams searchParams={searchParams} />
      </Suspense>
    </AuthLayout>
  );
}

async function LoginWithParams({ searchParams }: { searchParams: SearchParams }) {
  if (await getCurrentUser()) redirect("/");
  const next = (await searchParams).next;
  return <LoginForm next={typeof next === "string" ? next : undefined} />;
}
