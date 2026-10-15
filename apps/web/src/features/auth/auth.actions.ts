"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAppError, toArabicMessage, type ActionState } from "@/lib/errors";
import { loginSchema, safeNextPath, setPasswordSchema } from "./auth.schema";
import { authenticate } from "./auth.service";
import { acceptInvite } from "./invite.service";
import { createSession, destroySession } from "./session";

async function requestMeta() {
  const h = await headers();
  // ورا reverse proxy (nginx/caddy) أول IP في x-forwarded-for هو العميل
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return { ip, userAgent: h.get("user-agent") };
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  const values = { email: String(formData.get("email") ?? "").slice(0, 200) };
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const meta = await requestMeta();
  try {
    const { userId } = await authenticate(parsed.data.email, parsed.data.password, meta);
    await createSession(userId, meta);
  } catch (e) {
    if (!isAppError(e)) console.error("[login]", e);
    return { ok: false, message: toArabicMessage(e), values };
  }
  // redirect برّه الـ try: بيشتغل بـ throw
  redirect(safeNextPath(parsed.data.next));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function setPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = setPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    const { userId } = await acceptInvite(parsed.data.token, parsed.data.password);
    await createSession(userId, await requestMeta());
  } catch (e) {
    if (!isAppError(e)) console.error("[set-password]", e);
    return { ok: false, message: toArabicMessage(e) };
  }
  redirect("/");
}
