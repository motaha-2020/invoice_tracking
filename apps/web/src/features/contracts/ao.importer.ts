import "server-only";
import type { ImportPreview, Importer, ParsedWorkbook, RowResult } from "@/features/imports/import.types";
import { code, date, isExampleRow, itemNo, num, pctCell, text, yesNo } from "@/features/imports/cells";
import { registerImporter } from "@/features/imports/registry";
import { commitAo, type AoHeader, type AoRow } from "./ao.commit";
import { addendumMode, normalizeAoNo } from "./contracts.rules";
import { findAo, findContractForAo, findProjectByCode, listMaterialCodes } from "./contracts.import.repo";

/**
 * القالب 06: أمر التكليف (الأصلي = ملحق 0) أو ملحق زيادة (1، 2 ...).
 * - ملحق 0: الكميات المخططة في الملف بتستبدل الموجودة.
 * - ملحق > 0: بيتسجل AoChange (increase) والكميات بتتزوّد أو بتتستبدل لكل (بند، موقع) —
 *   حسب هل كميات الملف = الزيادة ولا = الإجمالي الجديد (addendumMode).
 * - لو الالتزام المالي اتغير: AoChange (commitment_renewal).
 */
const TEMPLATE_ID = "06_أمر_التكليف";
const HEAD = "بيانات أمر التكليف";
const ITEMS = "بنود أمر التكليف";
const MATS = "مهمات أمر التكليف";

const money = (n: number) => Math.round(n).toLocaleString("en-US");

async function validate(wb: ParsedWorkbook): Promise<ImportPreview<AoRow>> {
  const s = wb.sheets[HEAD];
  const kv = s?.kind === "kv" ? s.values : {};
  const table = (name: string) => {
    const t = wb.sheets[name];
    return t?.kind === "table" ? t.rows : [];
  };
  const errors: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  const take = <T>(c: { value?: T; error?: string }, fb: T): T => (c.error != null ? (errors.push(c.error), fb) : (c.value as T));

  const contractNo = code(kv.contract_no);
  const contract = contractNo ? await findContractForAo(contractNo) : null;
  if (!contractNo) errors.push("رقم العقد إلزامي");
  else if (!contract) errors.push(`العقد ${contractNo} مش متسجل — ارفع قالب العقد والمقايسة الأول`);
  const aoNo = normalizeAoNo(kv.ao_no);
  if (!aoNo) errors.push("رقم أمر التكليف إلزامي");
  const rev = take(num(kv.revision, "رقم الملحق", { min: 0 }), null) ?? 0;
  if (!Number.isInteger(rev)) errors.push("رقم الملحق لازم رقم صحيح (0 = الأصلي)");
  const ex = contract && aoNo ? await findAo(contract.id, aoNo) : null;

  // الخطابات الممسوحة ساعات فيها السنة بس — ده مش سبب نوقف أمر التكليف كله
  const yearOnly = /^\d{4}$/.test(text(kv.ao_date));
  const aoDate = yearOnly ? null : take(date(kv.ao_date, "تاريخ أمر التكليف"), null);
  if (yearOnly) warnings.push(`تاريخ أمر التكليف "${text(kv.ao_date)}" سنة بس — هيتساب فاضي لحد ما يتصحح`);
  else if (!aoDate && !text(kv.ao_date)) warnings.push("تاريخ أمر التكليف فاضي");
  const pc = code(kv.project_code);
  let projectId: string | null = null;
  let projectName: string | null = null;
  if (!pc || pc.includes("?")) {
    warnings.push("أمر التكليف مش مربوط بمشروع (كود المشروع فاضي أو PJ-?) — النطاق والسنترال مش هيتعرفوا لحد ما يتربط");
  } else {
    const prj = await findProjectByCode(pc);
    if (!prj) errors.push(`المشروع ${pc} مش موجود — ارفع قالب المشروعات الأول أو سيب الخانة فاضية`);
    else ({ id: projectId, name: projectName } = prj);
  }
  let name = text(kv.name);
  if (!name && !ex) {
    name = projectName ?? aoNo;
    warnings.push(`مفيش اسم لأمر التكليف — هيتسمى "${name}"`);
  }
  const aoValue = take(num(kv.ao_value, "قيمة أمر التكليف", { min: 0 }), null);
  const increase = take(num(kv.increase_value, "قيمة الزيادة", { min: 0 }), null);
  const fc = take(num(kv.financial_commitment, "الالتزام المالي", { min: 0 }), null);

  if (rev > 0 && ex?.changes.some((c) => c.kind === "increase" && c.reference === `ملحق ${rev}`)) {
    errors.push(`الملحق رقم ${rev} اترفع قبل كده على ${aoNo}`);
  }
  if (rev > 0 && !ex && contract) warnings.push("أمر التكليف الأصلي مش متسجل — هيتعمل من الملحق ده، والقيمة قبل الزيادة = القيمة − الزيادة");
  if (rev === 0 && ex) notes.push(`أمر التكليف ${aoNo} موجود — الكميات المخططة في الملف هتستبدل الموجودة.`);

  // ── البنود ──
  const items = new Map((contract?.items ?? []).map((i) => [i.itemNo, i]));
  const exQty = new Map((ex?.items ?? []).map((i) => [`${i.contractItemId}|${i.site?.code ?? ""}`, Number(i.plannedQty)]));
  const exSites = new Set((ex?.sites ?? []).map((x) => x.code));
  const rows: RowResult<AoRow>[] = [];
  const seen = new Map<string, number>();
  let fileValue = 0;
  for (const r of table(ITEMS)) {
    if (isExampleRow(r)) continue;
    const e: string[] = [];
    const w: string[] = [];
    const no = itemNo(r.item_code);
    if (no.error) e.push(no.error);
    const it = no.value ? items.get(no.value) : undefined;
    if (no.value && contract && !it) e.push(`البند ${no.value} مش موجود في مقايسة العقد ${contract.contractNo}`);
    else if (it?.isGroup) e.push(`البند ${no.value} عنوان مجموعة — مش بند يتفوتر`);
    else if (it && it.unitPrice == null) w.push("البند مالوش سعر في العقد — مش هيدخل في قيمة أمر التكليف");
    const q = num(r.planned_qty, "الكمية المخططة", { min: 0 });
    if (q.error) e.push(q.error);
    else if (!q.value) e.push("الكمية المخططة لازم أكبر من صفر");
    const site = code(r.site_code) || null;
    const key = `${no.value ?? ""}|${site ?? ""}`;
    if (seen.has(key)) e.push(`البند متكرر لنفس الموقع (صف ${seen.get(key)})`);
    else seen.set(key, r.__row);
    if (site && !exSites.has(site)) w.push(`موقع جديد ${site} هيتضاف`);
    const prev = it ? exQty.get(`${it.id}|${site ?? ""}`) : undefined;
    if (!e.length && it) fileValue += (q.value ?? 0) * Number(it.unitPrice ?? 0);
    rows.push({
      sheet: ITEMS,
      row: r.__row,
      status: e.length ? "error" : prev != null ? "update" : "create",
      label: `${no.value ?? text(r.item_code)}${site ? ` @ ${site}` : ""} — ${text(r.description) || it?.itemNo || ""}`.slice(0, 120),
      errors: e,
      warnings: w,
      data: it && q.value ? { kind: "item", contractItemId: it.id, site, qty: q.value } : undefined,
    });
  }

  // ── المهمات ──
  const matRows = table(MATS).filter((r) => !isExampleRow(r));
  if (matRows.length) {
    const catalog = new Map((await listMaterialCodes()).map((m) => [m.code, m.id]));
    const seenMat = new Map<string, number>();
    for (const r of matRows) {
      const c = code(r.material_code);
      const e: string[] = [];
      const q = num(r.planned_qty, "الكمية المخططة", { min: 0 });
      const base = { sheet: MATS, row: r.__row, label: `${c} ${text(r.description)}`.slice(0, 120) };
      if (!catalog.size) {
        rows.push({ ...base, status: "skip", errors: [], warnings: ["كتالوج المهمات لسه فاضي — ارفع القالب 07 الأول، الصف ده اتجاهل"] });
        continue;
      }
      if (!c) e.push("رقم الشطب إلزامي");
      else if (!catalog.has(c)) e.push(`الصنف ${c} مش في كتالوج المهمات`);
      if (q.error) e.push(q.error);
      else if (!q.value) e.push("الكمية المخططة لازم أكبر من صفر");
      if (seenMat.has(c)) e.push(`الصنف متكرر (صف ${seenMat.get(c)})`);
      else seenMat.set(c, r.__row);
      const id = catalog.get(c);
      const prev = id ? ex?.materials.find((m) => m.materialId === id) : undefined;
      rows.push({ ...base, status: e.length ? "error" : prev ? "update" : "create", errors: e, warnings: [], data: id && q.value ? { kind: "material", materialId: id, qty: q.value } : undefined });
    }
  }

  const okRows = rows.filter((r) => r.status === "create" || r.status === "update").length;
  if (!okRows && rows.some((r) => r.status === "error")) errors.push("مفيش ولا بند أو صنف سليم في الملف");
  else if (!rows.length) warnings.push(ex ? "مفيش بنود في الملف — الكميات المخططة الموجودة هتفضل زي ما هي" : "مفيش بنود في الملف — هيتسجل رأس أمر التكليف بس، والكميات تترفع بعدين");

  // ── القيمة ووضع الملحق ──
  const exValue = ex?.value == null ? null : Number(ex.value);
  let mode: "add" | "replace" = "replace";
  let newValue = aoValue;
  if (rev === 0) {
    if (ex?.changes.some((c) => c.kind === "increase")) {
      newValue = null; // القيمة الحالية فيها الملاحق — ما نرجعهاش للأصل
      warnings.push("أمر التكليف عليه ملاحق زيادة — الكميات هتتستبدل بكميات الأصلي، والقيمة الحالية (بعد الملاحق) هتفضل زي ما هي");
    } else if (aoValue == null && fileValue > 0) {
      newValue = Math.round(fileValue * 100) / 100;
      warnings.push(`قيمة أمر التكليف فاضية — اتحسبت من الكميات × أسعار العقد = ${money(fileValue)}`);
    } else if (aoValue && fileValue > 0 && Math.abs(fileValue - aoValue) / aoValue > 0.01) {
      warnings.push(`القيمة المكتوبة ${money(aoValue)} مختلفة عن الكميات × أسعار العقد (${money(fileValue)})`);
    }
  } else {
    mode = addendumMode(fileValue, increase, aoValue);
    const near = (t: number | null) => t != null && t > 0 && Math.abs(fileValue - t) / t <= 0.05;
    const base = aoValue != null && increase != null ? aoValue - increase : null;
    if (fileValue > 0 && near(base) && !near(aoValue)) {
      warnings.push(`قيمة كميات الملف (${money(fileValue)}) قريبة من القيمة قبل الزيادة (${money(base!)}) — غالباً دي كميات الأصلي مش الملحق، راجعها`);
    } else if (fileValue > 0 && !near(increase) && !near(aoValue)) {
      warnings.push(`قيمة كميات الملف (${money(fileValue)}) مش قريبة لا من الزيادة ولا من القيمة الجديدة — راجع الكميات`);
    }
    if (newValue == null && increase != null && exValue != null) newValue = exValue + increase;
    if (newValue == null) errors.push("قيمة أمر التكليف بعد الزيادة إلزامية في الملحق (أو قيمة الزيادة على أمر تكليف موجود)");
    notes.push(
      mode === "add"
        ? `ملحق ${rev}: كميات الملف هتتزوّد على المخطط (قيمتها ${money(fileValue)}).`
        : `ملحق ${rev}: كميات الملف هي الإجمالي بعد الزيادة (قيمتها ${money(fileValue)} قريبة من القيمة الجديدة) — هتستبدل المخطط للبنود اللي في الملف.`,
    );
  }
  const exFc = ex?.financialCommitment == null ? null : Number(ex.financialCommitment);
  if (ex && fc != null && fc !== exFc) notes.push(`الالتزام المالي هيتغير من ${exFc == null ? "—" : money(exFc)} لـ ${money(fc)} (هيتسجل تجديد التزام مالي).`);

  const header: AoHeader = {
    contractId: contract?.id ?? "",
    aoNo,
    rev,
    mode,
    existingId: ex?.id ?? null,
    aoDate: aoDate ? aoDate.toISOString().slice(0, 10) : null,
    name: name || null,
    projectId,
    value: newValue,
    increase,
    financialCommitment: fc,
    planningAnnexValue: take(num(kv.planning_annex_value, "ملحق التخطيط", { min: 0 }), null),
    area: text(kv.area) || null,
    centralText: text(kv.central) || null,
    outOfScope: text(kv.out_of_scope) ? yesNo(kv.out_of_scope) : null,
    duration: text(kv.duration) || null,
    finalGuaranteePct: take(pctCell(kv.final_guarantee_pct, "خطاب الضمان النهائي"), null),
    stampsTotal: take(num(kv.stamps_total, "إجمالي الدمغات", { min: 0 }), null),
  };

  const headRow: RowResult<AoRow> = {
    sheet: HEAD,
    row: 1,
    status: errors.length ? "error" : ex ? "update" : "create",
    label: `أمر التكليف ${aoNo || "—"}${rev ? ` — ملحق ${rev}` : ""} (${contractNo || "—"})`,
    errors,
    warnings,
  };
  if (errors.length) {
    for (const r of rows) {
      if (r.status === "create" || r.status === "update") {
        r.status = "skip";
        r.warnings.push("مش هيتحفظ لحد ما بيانات أمر التكليف تتصلح");
      }
    }
  }
  return { templateId: TEMPLATE_ID, rows: [headRow, ...rows], notes, header: header as unknown as Record<string, unknown> };
}

registerImporter({
  templateId: TEMPLATE_ID,
  title: "أمر التكليف / ملحق زيادة",
  templateFile: `${TEMPLATE_ID}.xlsx`,
  permission: "master.import",
  sheets: [
    { name: HEAD, kind: "kv" },
    { name: ITEMS, kind: "table" },
    { name: MATS, kind: "table", required: false },
  ],
  validate,
  commit: (preview, tx) => commitAo(preview, tx, HEAD),
} satisfies Importer<AoRow>);
