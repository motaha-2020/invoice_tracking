import { z } from "zod";

export const PASSWORD_MIN = 10;

/** مسار رجوع آمن بعد الدخول: لازم يكون داخلي (يبدأ بـ / ومش // ولا /\) */
export function safeNextPath(v: unknown): string {
  if (typeof v !== "string" || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return "/";
  if (v.startsWith("/login") || v.startsWith("/invite")) return "/";
  return v;
}

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "يرجى إدخال البريد الإلكتروني")
    .max(200)
    .pipe(z.email("صيغة البريد الإلكتروني غير صحيحة")),
  password: z.string().min(1, "يرجى إدخال كلمة المرور").max(200),
  next: z.string().optional(),
});

export const setPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: z
      .string()
      .min(PASSWORD_MIN, `يجب ألا تقل كلمة المرور عن ${PASSWORD_MIN} حروف`)
      .max(128, "كلمة المرور أطول من الحد المسموح"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "كلمتا المرور غير متطابقتين" });
