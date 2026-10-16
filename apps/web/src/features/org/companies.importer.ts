import "server-only";
import { registerImporter } from "@/features/imports/registry";
import type { Importer, ParsedWorkbook } from "@/features/imports/import.types";
import { COMPANIES_SHEET, validateCompanyRows, type CompanyImportRow } from "./companies-import.rules";
import { commitRows } from "./import-commit";
import { loadExistingCompanies, upsertCompanyRow } from "./org-import.repo";

/** قالب 03 — الشركات المنفذة */
export const companiesImporter: Importer<CompanyImportRow> = {
  templateId: "03_الشركات",
  title: "الشركات المنفذة",
  templateFile: "03_الشركات.xlsx",
  permission: "org.manage",
  sheets: [{ name: COMPANIES_SHEET, kind: "table" }],

  async validate(wb: ParsedWorkbook) {
    const sheet = wb.sheets[COMPANIES_SHEET];
    const rows = validateCompanyRows(sheet?.kind === "table" ? sheet.rows : [], await loadExistingCompanies());
    return { templateId: this.templateId, rows, notes: rows.length ? [] : ["لا يتضمن الملف أي صفوف بيانات"] };
  },

  commit(preview, tx) {
    return commitRows(preview, tx, upsertCompanyRow);
  },
};

registerImporter(companiesImporter);
