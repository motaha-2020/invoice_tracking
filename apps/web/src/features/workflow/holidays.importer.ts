import "server-only";
import { date, isExampleRow, required } from "@/features/imports/cells";
import type { Importer, RowResult } from "@/features/imports/import.types";
import { registerImporter } from "@/features/imports/registry";
import { findHolidays, upsertHolidaysTx } from "./workflow.repo";

/**
 * قالب 12 الأجازات الرسمية: (التاريخ، المناسبة). يوم موجود ← الاسم بيتحدث.
 * التاريخ بيتخزن في المعاينة كنص yyyy-mm-dd (المعاينة JSON).
 */
const SHEET = "الأجازات";
type HolidayRow = { date: string; name: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);

const importer: Importer<HolidayRow> = {
  templateId: "12_الأجازات_الرسمية",
  title: "العطلات الرسمية",
  templateFile: "12_الأجازات_الرسمية.xlsx",
  permission: "workflow.config",
  sheets: [{ name: SHEET, kind: "table" }],

  async validate(wb) {
    const sheet = wb.sheets[SHEET];
    const raw = sheet?.kind === "table" ? sheet.rows.filter((r) => !isExampleRow(r)) : [];
    const parsed = raw.map((r) => ({ r, d: date(r.date, "التاريخ"), n: required(r.name, "المناسبة") }));
    const dates = parsed.flatMap((p) => (p.d.value ? [p.d.value] : []));
    const existing = new Map((dates.length ? await findHolidays(dates) : []).map((h) => [iso(h.date), h.name]));

    const seen = new Set<string>();
    const rows: RowResult<HolidayRow>[] = parsed.map(({ r, d, n }) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      if (d.error) errors.push(d.error);
      else if (!d.value) errors.push("التاريخ إلزامي");
      if (n.error) errors.push(n.error);
      const day = d.value ? iso(d.value) : "";
      const label = `${day || "—"} · ${n.value ?? "—"}`;
      if (errors.length || !n.value) return { sheet: SHEET, row: r.__row, status: "error" as const, label, errors, warnings };
      if (seen.has(day)) return { sheet: SHEET, row: r.__row, status: "skip" as const, label, errors, warnings: ["هذا اليوم مكرر في الملف"] };
      seen.add(day);
      const wd = d.value!.getUTCDay();
      if (wd === 5 || wd === 6) warnings.push("هذا اليوم يوافق الجمعة أو السبت — وهو غير محتسب أصلاً ضمن المدة المستهدفة (SLA)");
      const old = existing.get(day);
      if (old === n.value) return { sheet: SHEET, row: r.__row, status: "skip" as const, label, errors, warnings: [...warnings, "مسجلة بالاسم نفسه"] };
      if (old) warnings.push(`سيتغير الاسم الحالي "${old}"`);
      return { sheet: SHEET, row: r.__row, status: old ? ("update" as const) : ("create" as const), label, errors, warnings, data: { date: day, name: n.value } };
    });
    return { templateId: importer.templateId, rows, notes: [] };
  },

  async commit(preview, tx) {
    const rows = preview.rows.flatMap((r) => (r.data ? [{ date: new Date(`${r.data.date}T00:00:00Z`), name: r.data.name }] : []));
    await upsertHolidaysTx(tx, rows);
    const created = preview.rows.filter((r) => r.status === "create").length;
    const updated = preview.rows.filter((r) => r.status === "update").length;
    return { message: `تم حفظ ${created} عطلة جديدة وتحديث ${updated} عطلة`, counts: { created, updated } };
  },
};

registerImporter(importer);
