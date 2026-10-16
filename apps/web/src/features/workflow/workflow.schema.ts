import { z } from "zod";
import { MAX_SLA_DAYS, WEEK_DAYS, type WeekDay } from "./workflow.rules";

const key = z.string().min(1).max(40);

export const slaMatrixSchema = z.record(key, z.record(key, z.number().int().min(0).max(MAX_SLA_DAYS).nullable())).refine((m) => Object.keys(m).length <= 20);

export const reasonNameSchema = z.string().trim().min(2, "يرجى إدخال السبب").max(200, "السبب أطول من الحد المسموح");

export const docTypeSchema = z.object({
  id: z.string().max(64).optional(),
  code: z
    .string()
    .trim()
    .min(2, "الكود إلزامي")
    .max(60)
    .regex(/^[a-z0-9_]+$/i, "يتكون الكود من الحروف الإنجليزية والأرقام و _ فقط")
    .transform((v) => v.toLowerCase()),
  name: z.string().trim().min(2, "الاسم إلزامي").max(200),
});

export const requiredDocSchema = z.object({
  projectTypeId: z.string().min(1).max(64),
  docTypeId: z.string().min(1).max(64),
  stage: z.enum(["submit", "finance"]),
  on: z.boolean(),
});

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "يرجى اختيار التاريخ");

export const holidaySchema = z.object({
  date: isoDateSchema,
  name: z.string().trim().min(2, "يرجى إدخال المناسبة").max(120),
});

export const settingsSchema = z.object({
  slaWarnAt: z.coerce.number().int("يجب إدخال عدد صحيح").min(0, "الحد الأدنى 0").max(10, "الحد الأقصى 10"),
  dailyDigestAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "الوقت غير صحيح"),
  weeklyReportDay: z.enum(WEEK_DAYS.map(([k]) => k) as [WeekDay, ...WeekDay[]]),
});
