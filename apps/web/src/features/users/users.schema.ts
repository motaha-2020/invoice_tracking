import type { Role, ScopeType } from "@it/db";
import { z } from "zod";
import { ALL_ROLES, SCOPE_TYPES } from "./users.rules";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ غير صحيح");

export const roleScopeSchema = z.object({
  role: z.enum(ALL_ROLES as unknown as [Role, ...Role[]], "الدور الوظيفي غير معروف"),
  scopeType: z.enum(SCOPE_TYPES as unknown as [ScopeType, ...ScopeType[]], "نوع نطاق الصلاحية غير معروف"),
  scopeId: z.string().max(64).nullable(),
});

export const userSchema = z.object({
  id: z.string().max(64).optional(),
  name: z.string().trim().min(2, "الاسم إلزامي").max(120, "الاسم أطول من الحد المسموح"),
  email: z.string().trim().toLowerCase().pipe(z.email("صيغة البريد الإلكتروني غير صحيحة").max(200)),
  phone: z.string().trim().max(30, "رقم الهاتف المحمول أطول من الحد المسموح").optional().transform((v) => v || null),
  active: z.boolean(),
  roles: z.array(roleScopeSchema).min(1, "يجب تحديد دور وظيفي واحد على الأقل").max(30),
});
export type UserInput = z.infer<typeof userSchema>;

export const delegationSchema = z
  .object({
    fromUserId: z.string().min(1, "يرجى اختيار المستخدم"),
    toUserId: z.string().min(1, "يرجى اختيار البديل"),
    startsOn: isoDate,
    endsOn: isoDate,
    note: z.string().trim().max(300).optional().transform((v) => v || null),
  })
  .refine((d) => d.fromUserId !== d.toUserId, { message: "يجب أن يكون البديل مستخدماً آخر", path: ["toUserId"] })
  .refine((d) => d.endsOn >= d.startsOn, { message: "تاريخ النهاية يسبق تاريخ البداية", path: ["endsOn"] });
export type DelegationInput = z.infer<typeof delegationSchema>;
