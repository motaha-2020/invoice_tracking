import { z } from "zod";

/** نموذج «خادم البريد الإلكتروني». الخادم فاضي = إيقاف الإرسال من الشاشة (والرجوع لإعدادات السيرفر لو موجودة) */
export const smtpSchema = z
  .object({
    host: z.string().trim().max(253, "اسم الخادم أطول من الحد المسموح").regex(/^[a-zA-Z0-9.-]*$/, "اسم الخادم غير صحيح — مثال: smtp.office365.com"),
    port: z.coerce.number().int("رقم المنفذ غير صحيح").min(1, "رقم المنفذ غير صحيح").max(65535, "رقم المنفذ غير صحيح"),
    security: z.enum(["starttls", "ssl"]),
    user: z.string().trim().max(254, "اسم المستخدم أطول من الحد المسموح"),
    /** فاضي = بدون تغيير */
    password: z.string().max(500, "كلمة المرور أطول من الحد المسموح").optional(),
    clearPassword: z.boolean().optional(),
    from: z.union([z.literal(""), z.email("عنوان المرسل غير صحيح")]),
    fromName: z.string().trim().max(100, "اسم المرسل أطول من الحد المسموح"),
  })
  .refine((v) => !v.host || v.from || v.user.includes("@"), { message: "يرجى إدخال عنوان البريد الذي تُرسل منه الرسائل", path: ["from"] });

export type SmtpInput = z.infer<typeof smtpSchema>;
