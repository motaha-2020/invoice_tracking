import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert, ButtonLink, Skeleton } from "@/components/ui";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { SetPasswordForm } from "@/features/auth/components/set-password-form";
import { getValidInvite } from "@/features/auth/invite.service";

export const metadata: Metadata = { title: "تفعيل الحساب" };

type Params = Promise<{ token: string }>;

export default function InvitePage({ params }: { params: Params }) {
  return (
    <AuthLayout>
      <Suspense fallback={<InviteFallback />}>
        <InviteContent params={params} />
      </Suspense>
    </AuthLayout>
  );
}

async function InviteContent({ params }: { params: Params }) {
  const { token } = await params;
  const invite = await getValidInvite(token);

  if (!invite) {
    return (
      <>
        <h2 className="m-0 mb-4 text-[22px] font-bold">تفعيل الحساب</h2>
        <Alert tone="r" title="رابط الدعوة غير صالح">
          ربما استُخدم الرابط من قبل أو انقضت مدة صلاحيته (72 ساعة). يرجى طلب رابط جديد من مدير النظام.
        </Alert>
        <ButtonLink href="/login" className="mt-4">
          صفحة الدخول
        </ButtonLink>
      </>
    );
  }

  return (
    <>
      <h2 className="m-0 mb-1 text-[22px] font-bold">{invite.purpose === "reset" ? "تعيين كلمة مرور جديدة" : "مرحباً بكم في المنظومة"}</h2>
      <p className="m-0 mb-5 text-tx3">
        {invite.userName} — <span dir="ltr">{invite.email}</span>
        <br />
        يرجى اختيار كلمة المرور التي ستستخدمها لتسجيل الدخول.
      </p>
      <SetPasswordForm token={token} email={invite.email} />
    </>
  );
}

function InviteFallback() {
  return (
    <div role="status" aria-label="جارٍ التحميل" className="flex flex-col gap-3">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="mt-3 h-[34px]" />
      <Skeleton className="h-[34px]" />
    </div>
  );
}
