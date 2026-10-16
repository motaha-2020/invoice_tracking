import type { Prisma } from "@it/db";
import type { SessionUser } from "@/features/auth/auth.types";
import type { Permission } from "@/features/auth/permission-rules";

/**
 * محرك الاستيراد الموحد — كل قالب Excel (01..12) ليه Importer واحد بيسجّل نفسه في registry.ts.
 *
 * الدورة:  رفع الملف ← parse (xlsx-parse.ts) ← importer.validate ← معاينة (ImportBatch status=preview)
 *          ← المستخدم يأكد ← importer.commit جوه transaction واحدة ← ImportBatch status=done + audit.
 *
 * القوالب: صف 1 عناوين عربي، صف 2 أسماء الأعمدة التقنية (الـ parser بيعتمد عليه)، البيانات من صف 3.
 * شيتات "مفتاح/قيمة" (بيانات العقد / بيانات أمر التكليف): العمود C = المفتاح، B = القيمة.
 */

/** صف من شيت جدول بعد الـ parse — المفاتيح هي أسماء الأعمدة التقنية (صف 2) */
export type RawRow = { __row: number } & Record<string, unknown>;

export type ParsedSheet =
  | { name: string; kind: "table"; rows: RawRow[] }
  | { name: string; kind: "kv"; values: Record<string, unknown> };

export type ParsedWorkbook = {
  /** من الشيت المخفي _meta — بنتأكد إن الملف هو القالب الصح */
  templateId: string | null;
  templateVersion: string | null;
  sheets: Record<string, ParsedSheet>;
  /** صفوف مطابقة لصفوف المثال في القالب واتجاهلت — بتظهر كملاحظة في المعاينة (sheet → أرقام الصفوف) */
  skippedExamples: Record<string, number[]>;
};

export type RowStatus = "create" | "update" | "skip" | "error";

/** نتيجة فحص صف — data هي القيمة المتنضفة اللي هتتحفظ لو اتأكد */
export type RowResult<T = unknown> = {
  sheet: string;
  row: number;
  status: RowStatus;
  /** وصف قصير للصف في المعاينة (مثلاً: "1-1-1-2 غرفة تفتيش HH-I") */
  label: string;
  errors: string[];
  warnings: string[];
  data?: T;
};

export type ImportPreview<T = unknown> = {
  templateId: string;
  rows: RowResult<T>[];
  /** ملاحظات على مستوى الملف كله (مثلاً: العقد موجود وهيتحدث) */
  notes: string[];
  /** بيانات مشتركة يحتاجها الـ commit (مثلاً رأس العقد) */
  header?: Record<string, unknown>;
};

export type ImportContext = {
  user: SessionUser;
};

export type CommitResult = {
  /** رسالة عربي للمستخدم بعد الحفظ */
  message: string;
  counts: Record<string, number>;
};

export interface Importer<T = unknown> {
  /** نفس template_id اللي في _meta (مثلاً "05_العقد_والمقايسة") */
  templateId: string;
  title: string;
  /** اسم ملف القالب للتنزيل من /templates */
  templateFile: string;
  /** الصلاحية المطلوبة (من RolePermission) */
  permission: Permission;
  /** أسماء الشيتات المطلوبة ونوعها */
  sheets: { name: string; kind: "table" | "kv"; required?: boolean }[];
  /** فحص من غير أي كتابة في DB (قراءة بس للتأكد من الأكواد الموجودة) */
  validate(wb: ParsedWorkbook, ctx: ImportContext): Promise<ImportPreview<T>>;
  /** الحفظ — بيتنادى جوه transaction واحدة، وبياخد الصفوف السليمة بس */
  commit(preview: ImportPreview<T>, tx: Prisma.TransactionClient, ctx: ImportContext): Promise<CommitResult>;
}
