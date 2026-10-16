"use client";

import { LogIn } from "lucide-react";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { ActionState } from "@/lib/errors";
import { loginAction } from "../auth.actions";

const initial: ActionState = { ok: false };

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-3.5" noValidate>
      {state.message && <Alert tone="r">{state.message}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="البريد الإلكتروني" htmlFor="email" error={fe.email}>
        <Input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="username"
          defaultValue={state.values?.email}
          required
          autoFocus
          aria-invalid={fe.email ? true : undefined}
          className="text-start"
        />
      </Field>
      <Field label="كلمة المرور" htmlFor="password" error={fe.password}>
        <Input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          required
          aria-invalid={fe.password ? true : undefined}
        />
      </Field>
      <Button type="submit" variant="pr" disabled={pending} className="mt-1 w-full">
        <LogIn />
        {pending ? "جارٍ تسجيل الدخول…" : "تسجيل الدخول"}
      </Button>
      <p className="m-0 text-xs text-tx3">
        في حال نسيان كلمة المرور أو عدم وجود حساب، يرجى التواصل مع مدير النظام لإرسال رابط دعوة.
      </p>
    </form>
  );
}
