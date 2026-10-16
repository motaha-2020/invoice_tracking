/**
 * zod schemas لفورم الإضافة والتعديل (الهيكل + أنواع المشروعات والأعمال + المشروعات + الشركات).
 * الكود بيتكتب مرة واحدة عند الإضافة ومش بيتعدل بعد كده — فـ schema التعديل مفيهوش code.
 */
import { z } from "zod";
import { code as normalizeCode } from "../imports/cells";
import { CODE_MAX, CODE_RE, NAME_MAX } from "./import-rules.shared";
import type { OrgKind } from "./org.kinds";

export const codeSchema = z
  .string("يرجى إدخال الكود")
  .transform((v) => normalizeCode(v))
  .pipe(
    z
      .string()
      .min(1, "يرجى إدخال الكود")
      .max(CODE_MAX, `يجب ألا يتجاوز الكود ${CODE_MAX} حرفاً`)
      .regex(CODE_RE, "يتكون الكود من الحروف والأرقام و - _ . / & فقط (دون مسافات)"),
  );

const name = (max = NAME_MAX) => z.string("يرجى إدخال الاسم").trim().min(1, "يرجى إدخال الاسم").max(max, `يجب ألا يتجاوز الاسم ${max} حرفاً`);
const ref = (msg: string) => z.string(msg).trim().min(1, msg).max(64);
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `يجب ألا يتجاوز ${max} حرفاً`)
    .optional()
    .transform((v) => (v ? v : null));
const email = z.string("يرجى إدخال البريد الإلكتروني").trim().toLowerCase().max(200).pipe(z.email("صيغة البريد الإلكتروني غير صحيحة"));
/** من <input type="date">: yyyy-mm-dd أو فاضي */
const optDate = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))), "التاريخ غير صحيح")
  .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));

/** checkbox: بيتبعت "1" لو متعلّم، وغير كده مش بيتبعت خالص */
const flag = z.string().optional().transform((v) => v === "1" || v === "on");
const sortNo = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? Number(v) : 0))
  .pipe(z.number("يجب أن يكون الترتيب رقماً").int("يجب أن يكون الترتيب عدداً صحيحاً").min(0, "يجب أن يكون الترتيب بين 0 و9999").max(9999, "يجب أن يكون الترتيب بين 0 و9999"));

/** الحقول القابلة للتعديل لكل نوع (من غير الكود) */
const FIELDS = {
  presidency: { name: name() },
  sector: { name: name(), presidencyId: ref("يرجى اختيار رئاسة القطاعات") },
  techUnit: { name: name(), sectorId: ref("يرجى اختيار القطاع") },
  generalDept: { name: name(), sectorId: ref("يرجى اختيار القطاع") },
  dept: { name: name(), generalDeptId: ref("يرجى اختيار الإدارة العامة") },
  central: { name: name(), deptId: ref("يرجى اختيار الإدارة المختصة") },
  projectType: { name: name() },
  workType: { name: name(), isPlanning: flag, active: flag, sort: sortNo },
  project: {
    name: name(),
    typeId: ref("يرجى اختيار نوع المشروع"),
    centralId: ref("يرجى اختيار السنترال"),
    startDate: optDate,
    notes: opt(1000),
  },
  company: {
    name: name(100),
    fullName: name(300),
    email,
    commercialReg: opt(60),
    taxNo: opt(60),
    phone: opt(60),
    address: opt(400),
  },
} satisfies Record<OrgKind, z.ZodRawShape>;

export type OrgFields = { [K in OrgKind]: z.infer<z.ZodObject<(typeof FIELDS)[K]>> };

/** بيانات متحققة — kind بيحدد شكل fields (discriminated union) */
export type OrgData = { [K in OrgKind]: { kind: K; fields: OrgFields[K] } }[OrgKind];

export type ParseResult =
  | { ok: true; data: OrgData; code: string | null }
  | { ok: false; fieldErrors: Record<string, string[] | undefined> };

/**
 * فحص قيم الفورم. withCode = إضافة (الكود إلزامي)، غير كده تعديل (أي code بيتجاهل).
 */
export function parseOrgInput(kind: OrgKind, raw: Record<string, unknown>, withCode: boolean): ParseResult {
  const parsed = z.object(FIELDS[kind]).safeParse(raw);
  const fieldErrors: Record<string, string[] | undefined> = parsed.success ? {} : { ...z.flattenError(parsed.error).fieldErrors };
  let code: string | null = null;
  if (withCode) {
    const c = codeSchema.safeParse(raw.code);
    if (c.success) code = c.data;
    else fieldErrors.code = z.flattenError(c.error).formErrors;
  }
  if (!parsed.success || Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
  return { ok: true, data: { kind, fields: parsed.data } as OrgData, code };
}
