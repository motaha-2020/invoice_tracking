import "server-only";
import { isExampleRow, required, text } from "@/features/imports/cells";
import type { Importer, RowResult } from "@/features/imports/import.types";
import { registerImporter } from "@/features/imports/registry";
import { materialCode } from "./material-keys";
import { findMaterialsByCodes, upsertMaterial } from "./materials.repo";

/** 07 كتالوج المهمات — upsert بالكود (رقم الشطب) */
const SHEET = "المهمات";
const SUPPLIERS = ["المصرية للاتصالات", "الشركة المنفذة"];

type Row = { code: string; description: string; unit: string; suppliedBy: string | null; groupName: string | null };

export const materialsImporter: Importer<Row> = {
  templateId: "07_كتالوج_المهمات",
  title: "كتالوج المهمات",
  templateFile: "07_كتالوج_المهمات.xlsx",
  permission: "issues.import",
  sheets: [{ name: SHEET, kind: "table" }],

  async validate(wb) {
    const sheet = wb.sheets[SHEET];
    const raw = sheet?.kind === "table" ? sheet.rows.filter((r) => !isExampleRow(r)) : [];
    const existing = new Map((await findMaterialsByCodes([...new Set(raw.map((r) => materialCode(r.material_code)).filter(Boolean))])).map((m) => [m.code, m]));
    const seen = new Map<string, number>();

    const rows = raw.map((r): RowResult<Row> => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const code = materialCode(r.material_code);
      const desc = required(r.description, "الوصف");
      const unit = required(r.unit, "الوحدة");
      if (!code) errors.push("رقم الشطب إلزامي");
      if (desc.error) errors.push(desc.error);
      if (unit.error) errors.push(unit.error);
      const suppliedBy = text(r.supplied_by) || null;
      if (suppliedBy && !SUPPLIERS.includes(suppliedBy)) warnings.push(`جهة التوريد "${suppliedBy}" غير مدرجة في القائمة`);
      if (code) {
        const first = seen.get(code);
        if (first) errors.push(`رقم الشطب ${code} مكرر في الملف (الصف ${first})`);
        else seen.set(code, r.__row);
      }
      const ex = existing.get(code);
      if (ex && unit.value && ex.unit !== unit.value && ex._count.issues > 0) {
        warnings.push(`ستتغير الوحدة من ${ex.unit} إلى ${unit.value} مع وجود منصرف مسجل على هذا الصنف`);
      }
      const label = `${code || "—"} ${desc.value ?? ""}`.trim();
      if (errors.length) return { sheet: SHEET, row: r.__row, status: "error", label, errors, warnings };
      return {
        sheet: SHEET,
        row: r.__row,
        status: ex ? "update" : "create",
        label,
        errors,
        warnings,
        data: { code, description: desc.value!, unit: unit.value!, suppliedBy, groupName: text(r.group) || null },
      };
    });

    const notes = rows.length ? [] : ["لا توجد صفوف في ورقة عمل المهمات"];
    return { templateId: materialsImporter.templateId, rows, notes };
  },

  async commit(preview, tx) {
    let created = 0;
    let updated = 0;
    for (const r of preview.rows) {
      if (!r.data) continue;
      await upsertMaterial(tx, r.data);
      if (r.status === "create") created++;
      else updated++;
    }
    return { message: `تم حفظ ${created} صنف جديد وتحديث ${updated} صنف في كتالوج المهمات`, counts: { created, updated } };
  },
};

registerImporter(materialsImporter);
