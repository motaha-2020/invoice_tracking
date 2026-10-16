import "server-only";
import { registerImporter } from "@/features/imports/registry";
import type { Importer, ParsedWorkbook, RawRow } from "@/features/imports/import.types";
import { optionalEmail } from "./import-rules.shared";
import { commitRows } from "./import-commit";
import { loadExistingOrg, loadUsersByEmail, upsertOrgRow } from "./org-import.repo";
import { ORG_SHEETS, validateOrgSheets, type OrgImportRow } from "./org-import.rules";

/** قالب 01 — الهيكل التنظيمي (رئاسات ← قطاعات ← إدارات عامة/شئون فنية ← إدارات مختصة ← سنترالات) */
export const orgImporter: Importer<OrgImportRow> = {
  templateId: "01_الهيكل_التنظيمي",
  title: "الهيكل التنظيمي",
  templateFile: "01_الهيكل_التنظيمي.xlsx",
  permission: "master.import",
  sheets: ORG_SHEETS.map((s) => ({ name: s.sheet, kind: "table" as const })),

  async validate(wb: ParsedWorkbook) {
    const sheets = tableRows(wb);
    const emails = (sheets["الإدارات العامة"] ?? [])
      .map((r) => optionalEmail(r.gm_email, "").value)
      .filter((e): e is string => !!e);
    const [existing, users] = await Promise.all([loadExistingOrg(), loadUsersByEmail([...new Set(emails)])]);
    const rows = validateOrgSheets(sheets, existing, users);
    const notes = rows.length ? [] : ["الملف مفيهوش أي صفوف بيانات"];
    return { templateId: this.templateId, rows, notes };
  },

  commit(preview, tx) {
    return commitRows(preview, tx, upsertOrgRow);
  },
};

export function tableRows(wb: ParsedWorkbook): Record<string, RawRow[]> {
  const out: Record<string, RawRow[]> = {};
  for (const [name, s] of Object.entries(wb.sheets)) if (s.kind === "table") out[name] = s.rows;
  return out;
}

registerImporter(orgImporter);
