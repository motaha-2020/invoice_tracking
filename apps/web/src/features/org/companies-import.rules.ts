/**
 * قواعد قالب 03 (الشركات المنفذة) — صافية.
 * الخلايا الاختيارية الفاضية في صف تحديث = سيب القيمة القديمة زي ما هي.
 */
import { text } from "../imports/cells";
import type { RawRow, RowResult } from "../imports/import.types";
import {
  SeenCodes,
  codeCell,
  duplicateError,
  failed,
  exampleWarning,
  optionalEmail,
  optionalText,
  requiredText,
  result,
  rowLabel,
  take,
} from "./import-rules.shared";

export const COMPANIES_SHEET = "الشركات";
const EXAMPLES = [{ code: "CO-BRIDGE", name: "بريدج" }];

export type CompanyFields = {
  name: string;
  fullName: string;
  email: string;
  commercialReg: string | null;
  taxNo: string | null;
  phone: string | null;
  address: string | null;
};

export type CompanyImportRow = CompanyFields & { code: string };

export type ExistingCompany = Omit<CompanyFields, "email"> & { email: string | null };

const OPTIONAL: readonly (keyof CompanyFields)[] = ["commercialReg", "taxNo", "phone", "address"];

export function validateCompanyRows(
  rows: readonly RawRow[],
  existing: ReadonlyMap<string, ExistingCompany>,
): RowResult<CompanyImportRow>[] {
  const seen = new SeenCodes();
  return rows.map((row) => validateRow(row, existing, seen));
}

function validateRow(row: RawRow, existing: ReadonlyMap<string, ExistingCompany>, seen: SeenCodes): RowResult<CompanyImportRow> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const code = take(codeCell(row.code, "كود الشركة"), errors);
  const name = take(requiredText(row.name, "الاسم المختصر", 100), errors);
  const label = rowLabel(code ?? (text(row.code) || undefined), name);
  if (code) {
    const prev = seen.check(code, row.__row);
    if (prev !== null) errors.push(duplicateError(code, prev));
  }
  const fullName = take(requiredText(row.full_name, "الاسم الكامل", 300), errors);
  const email = take(optionalEmail(row.email, "إيميل المستخلصات"), errors);
  if (email === null) errors.push("إيميل المستخلصات إلزامي — عليه بيوصل إشعار الصرف");
  const commercialReg = take(optionalText(row.commercial_reg, "السجل التجاري", 60), errors);
  const taxNo = take(optionalText(row.tax_no, "البطاقة الضريبية", 60), errors);
  const phone = take(optionalText(row.phone, "التليفون", 60), errors);
  const address = take(optionalText(row.address, "العنوان", 400), errors);
  if (typeof row.phone === "number") warnings.push("التليفون متسجل كرقم في Excel — اتأكد إن الصفر اللي في الأول ما ضاعش");
  const ex = exampleWarning(row, EXAMPLES);
  if (ex) warnings.push(ex);

  if (errors.length || !code || !name || !fullName || !email) {
    return failed(COMPANIES_SHEET, row.__row, label, errors, warnings);
  }
  const data: CompanyImportRow = {
    code,
    name,
    fullName,
    email,
    commercialReg: commercialReg ?? null,
    taxNo: taxNo ?? null,
    phone: phone ?? null,
    address: address ?? null,
  };
  const current = existing.get(code);
  if (!current) return result(COMPANIES_SHEET, row.__row, label, errors, warnings, "create", data);

  const changed =
    current.name !== name ||
    current.fullName !== fullName ||
    current.email !== email ||
    OPTIONAL.some((k) => data[k] !== null && data[k] !== current[k]);
  if (!changed) warnings.push("موجودة بنفس البيانات — مفيش تغيير");
  return result(COMPANIES_SHEET, row.__row, label, errors, warnings, changed ? "update" : "skip", data);
}

/** بيانات التحديث: الحقول الاختيارية الفاضية مش بتمسح القديم */
export function companyUpdateData(d: CompanyImportRow) {
  const out: Partial<CompanyFields> = { name: d.name, fullName: d.fullName, email: d.email };
  for (const k of OPTIONAL) if (d[k] !== null) out[k] = d[k] as string;
  return out;
}
