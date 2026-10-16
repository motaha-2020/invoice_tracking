"use client";

import { KeyRound } from "lucide-react";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { ActionState } from "@/lib/errors";
import { setPasswordAction } from "../auth.actions";
import { PASSWORD_MIN } from "../auth.schema";

const initial: ActionState = { ok: false };

export function SetPasswordForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(setPasswordAction, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-3.5" noValidate>
      {state.message && <Alert tone="r">{state.message}</Alert>}
      <input type="hidden" name="token" value={token} />
      {/* عشان مدير كلمات السر يربط كلمة السر بالحساب */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <Field
        label="كلمة المرور الجديدة"
        htmlFor="password"
        required
        hint={`${PASSWORD_MIN} حروف على الأقل — يُفضَّل استخدام عبارة طويلة يسهل تذكرها`}
        error={fe.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          required
          autoFocus
          aria-invalid={fe.password ? true : undefined}
        />
      </Field>
      <Field label="تأكيد كلمة المرور" htmlFor="confirm" required error={fe.confirm}>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          required
          aria-invalid={fe.confirm ? true : undefined}
        />
      </Field>
      {fe.token && <Alert tone="r">رابط الدعوة غير صالح</Alert>}
      <Button type="submit" variant="pr" disabled={pending} className="mt-1 w-full">
        <KeyRound />
        {pending ? "جارٍ الحفظ…" : "حفظ كلمة المرور وتسجيل الدخول"}
      </Button>
    </form>
  );
}
