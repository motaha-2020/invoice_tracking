import { z } from "zod";

/** التحقق من مدخلات حركات المسار (السيرفر بيتحقق دايماً حتى لو الفورم اتحقق) */
const note = z.string().trim().max(2000, "الملاحظة أطول من الحد المسموح (2000 حرف)");

export const actCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("approve"), note: note.optional() }),
  z.object({ type: z.literal("setCategory"), category: z.enum(["C1", "C2", "C3", "C4", "C5"], "يرجى اختيار الفئة"), note: note.optional() }),
  z.object({
    type: z.literal("return"),
    target: z.string().min(1, "يرجى اختيار الجهة المُعاد إليها").max(40),
    reasonIds: z.array(z.string().min(1).max(64)).min(1, "يرجى اختيار سبب واحد على الأقل للإعادة للاستيفاء").max(30),
    note: note.min(1, "يرجى إدخال ملاحظة توضح المطلوب استيفاؤه"),
  }),
  z.object({ type: z.literal("resubmit"), note: note.min(1, "يرجى توضيح ما تم استيفاؤه") }),
  z.object({ type: z.literal("hold"), reason: note.min(1, "يرجى إدخال سبب الإيقاف المؤقت") }),
  z.object({ type: z.literal("release"), note: note.optional() }),
  z.object({
    type: z.literal("pay"),
    ref: z.string().trim().min(1, "يرجى إدخال رقم الشيك أو التحويل البنكي").max(60),
    method: z.enum(["شيك", "تحويل بنكي"]),
    note: note.optional(),
  }),
  z.object({
    type: z.literal("qty"),
    lineId: z.string().min(1).max(64),
    qty: z.number("يرجى إدخال كمية صحيحة").finite().min(0, "يرجى إدخال كمية صحيحة (صفر أو أكثر)").max(1e12),
    reason: note.min(1, "يرجى توضيح سبب تعديل الكمية المعتمدة"),
  }),
]);
