import "server-only";
import { registerImporter } from "@/features/imports/registry";
import type { Importer, ParsedWorkbook } from "@/features/imports/import.types";
import { commitRows } from "./import-commit";
import { loadExistingProjects, upsertProjectsRow } from "./org-import.repo";
import { tableRows } from "./org.importer";
import { PROJECTS_SHEET, TYPES_SHEET, validateProjectSheets, type ProjectsImportRow } from "./projects-import.rules";

/** قالب 02 — أنواع المشروعات + المشروعات (كل مشروع مربوط بسنترال) */
export const projectsImporter: Importer<ProjectsImportRow> = {
  templateId: "02_المشروعات",
  title: "المشروعات وأنواعها",
  templateFile: "02_المشروعات.xlsx",
  permission: "master.import",
  sheets: [
    { name: TYPES_SHEET, kind: "table" },
    { name: PROJECTS_SHEET, kind: "table" },
  ],

  async validate(wb: ParsedWorkbook) {
    const rows = validateProjectSheets(tableRows(wb), await loadExistingProjects());
    return { templateId: this.templateId, rows, notes: rows.length ? [] : ["الملف مفيهوش أي صفوف بيانات"] };
  },

  // الأنواع جاية قبل المشروعات في المعاينة، فالمشروع بيلاقي نوعه الجديد
  commit(preview, tx) {
    return commitRows(preview, tx, upsertProjectsRow);
  },
};

registerImporter(projectsImporter);
