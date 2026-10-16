import { z } from "zod";

const cell = z.union([z.string().max(100), z.number()]);

export const lineRowsSchema = z
  .array(z.object({ code: z.string().max(60), qty: cell, site: z.string().max(60).optional(), manual: z.boolean().optional() }))
  .max(3000, "عدد البنود أكبر من الحد المسموح");

export const materialRowsSchema = z.array(z.object({ code: z.string().max(60), qty: cell })).max(2000, "عدد المهمات أكبر من الحد المسموح");

export const draftPayloadSchema = z.object({
  draftId: z.string().min(1).max(64).nullable(),
  aoId: z.string().min(1, "يرجى اختيار أمر التكليف").max(64),
  invoiceNo: z.string().trim().min(1, "يرجى إدخال رقم المستخلص").max(40, "رقم المستخلص أطول من الحد المسموح"),
  pathName: z.string().trim().min(1, "يرجى إدخال اسم المسار").max(300),
  period: z.string().trim().max(60),
  workTypeId: z.string().min(1, "يرجى اختيار نوع الأعمال").max(64),
  siteCode: z.string().trim().max(60),
  lines: lineRowsSchema,
  materials: materialRowsSchema,
});
