import "server-only";
import type { Prisma } from "@it/db";
import type { CommitResult, ImportPreview, Importer, ParsedWorkbook, RowResult } from "@/features/imports/import.types";
import { code, date, isExampleRow, itemNo, num, pctCell, text, type Cell } from "@/features/imports/cells";
import { registerImporter } from "@/features/imports/registry";
import { checkBoqHierarchy, checkPaymentTerms, parentOf } from "./contracts.rules";
import {
  createContractItems,
  findCompanyByCode,
  findContractForBoq,
  listContractItemIds,
  updateContractItems,
  upsertContract,
  type BoqItemWrite,
  type ContractWrite,
} from "./contracts.import.repo";

/**
 * القالب 05: رأس العقد (مفتاح/قيمة) + المقايسة.
 * العقد بيتحدث بـ contract_no والبنود بـ (العقد، رقم البند). البنود اللي مش في الملف بتفضل زي ما هي
 * (ممكن تكون عليها أوامر تكليف أو مستخلصات) — مفيش مسح أبداً.
 */
const TEMPLATE_ID = "05_العقد_والمقايسة";
const HEAD = "بيانات العقد";
const BOQ = "المقايسة";
const CURRENCIES = ["EGP", "USD", "EUR"];
const WORK_TYPES = new Set(["أعمال مدنية", "تركيبات", "كهربية", "توريد", "توريد وتركيب", "تخطيط ورسومات", "خدمات", "صيانة", "صواعد داخل المباني", "رفع كفاءة"]);

/** رأس العقد بعد التنضيف — JSON-safe (التواريخ ISO) عشان بيتخزن في ImportBatch.report */
type Header = Omit<ContractWrite, "awardDate" | "startDate" | "endDate"> & {
  awardDate: string | null;
  startDate: string | null;
  endDate: string | null;
  computeValue: boolean;
};
type Row = BoqItemWrite;

/** بيجمع أخطاء الخلايا في مكان واحد */
function collector() {
  const errors: string[] = [];
  const take = <T>(c: Cell<T>, fallback: T): T => {
    if (c.error != null) {
      errors.push(c.error);
      return fallback;
    }
    return c.value as T;
  };
  return { errors, take };
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

async function validate(wb: ParsedWorkbook): Promise<ImportPreview<Row>> {
  const head = wb.sheets[HEAD];
  const boq = wb.sheets[BOQ];
  const kv = head?.kind === "kv" ? head.values : {};
  const rawRows = boq?.kind === "table" ? boq.rows : [];
  const notes: string[] = [];
  const { errors, take } = collector();
  const warnings: string[] = [];

  const contractNo = code(kv.contract_no);
  if (!contractNo) errors.push("رقم العقد إلزامي");
  const companyCode = code(kv.company_code);
  const company = companyCode ? await findCompanyByCode(companyCode) : null;
  if (!companyCode) errors.push("كود الشركة إلزامي");
  else if (!company) errors.push(`الشركة ${companyCode} مش متسجلة — ارفع قالب الشركات الأول`);
  const title = text(kv.title);
  if (!title) errors.push("موضوع العقد إلزامي");
  const currency = code(kv.currency) || "EGP";
  if (!CURRENCIES.includes(currency)) errors.push(`العملة "${currency}" مش معروفة (EGP / USD / EUR)`);

  const p = (key: string, label: string, dflt: number | null) => take(pctCell(kv[key], label), null) ?? dflt;
  const monthly = take(pctCell(kv.pay_monthly_pct, "نسبة الصرف الشهري"), null);
  if (monthly == null) errors.push("نسبة الصرف مع المستخلص الشهري إلزامية");
  const asbuilt = p("pay_asbuilt_pct", "نسبة As-Built", 0)!;
  const handover = p("pay_handover_pct", "نسبة التسليم الابتدائي", 0)!;
  const terms = checkPaymentTerms(monthly, asbuilt, handover);
  if (monthly != null && !terms.ok) errors.push(terms.message);
  const warranty = take(num(kv.warranty_months, "مدة الضمان", { min: 0, max: 240 }), null);
  if (warranty != null && !Number.isInteger(warranty)) errors.push("مدة الضمان لازم عدد شهور صحيح");
  const contractValue = take(num(kv.contract_value, "قيمة العقد", { min: 0 }), null);

  const header: Header = {
    contractNo,
    companyId: company?.id ?? "",
    title,
    awardDate: iso(take(date(kv.award_date, "تاريخ برقية القبول"), null)),
    startDate: iso(take(date(kv.start_date, "تاريخ البدء"), null)),
    endDate: iso(take(date(kv.end_date, "تاريخ الانتهاء"), null)),
    currency,
    vatPct: p("vat_pct", "ضريبة القيمة المضافة", 14)!,
    payMonthlyPct: monthly ?? 0,
    payAsbuiltPct: asbuilt,
    payHandoverPct: handover,
    planningPayPct: p("planning_pay_pct", "نسبة صرف التخطيط", 100)!,
    finalGuaranteePct: p("final_guarantee_pct", "خطاب الضمان النهائي", 5)!,
    delayFinePctWeek: p("delay_fine_pct_week", "غرامة التأخير", null),
    delayFineCapPct: p("delay_fine_cap_pct", "الحد الأقصى للغرامة", null),
    warrantyMonths: warranty,
    outOfScopeUplift: text(kv.out_of_scope_uplift) || null,
    stampEngineeringPct: p("stamp_engineering_pct", "دمغة المهن الهندسية", 0.3)!,
    stampAppliedArtsPct: p("stamp_applied_arts_pct", "دمغة الفنون التطبيقية", 0.3)!,
    stampConstructionPct: p("stamp_construction_pct", "دمغة التشييد والبناء", 0.05)!,
    taxPct: p("tax_pct", "الخصم من المنبع", null),
    retentionPct: p("retention_pct", "تأمين ضمان الأعمال", 0)!,
    advancePct: p("advance_pct", "الدفعة المقدمة", 0)!,
    contractValue,
    computeValue: contractValue == null,
  };
  if (header.taxPct == null) warnings.push("نسبة الخصم من المنبع فاضية — المالية هتحددها");

  const existing = contractNo ? await findContractForBoq(contractNo) : null;
  if (existing && company && existing.companyId !== company.id) {
    errors.push(`العقد ده متسجل باسم شركة تانية (${existing.company.name})`);
  }
  const dbItems = new Map((existing?.items ?? []).map((i) => [i.itemNo, i]));
  if (existing) notes.push(`العقد ${contractNo} موجود — البيانات والأسعار هتتحدث، والبنود اللي مش في الملف هتفضل زي ما هي.`);

  // ── المقايسة ──
  const rows: RowResult<Row>[] = [];
  const refs: { row: number; itemNo: string }[] = [];
  let order = 0;
  for (const r of rawRows) {
    if (isExampleRow(r)) {
      rows.push({ sheet: BOQ, row: r.__row, status: "skip", label: text(r.description).slice(0, 80), errors: [], warnings: ["صف مثال — اتجاهل"] });
      continue;
    }
    const c = collector();
    const w: string[] = [];
    const no = c.take(itemNo(r.item_code), "");
    const description = text(r.description);
    if (!description) c.errors.push("وصف البند إلزامي");
    const unit = text(r.unit) || null;
    const isGroup = !unit;
    const qty = c.take(num(r.contract_qty, "كمية العقد", { min: 0 }), null);
    let price = c.take(num(r.unit_price, "سعر الوحدة", { min: 0 }), null);
    const workType = text(r.work_type) || null;
    if (isGroup) {
      if (price) w.push("صف من غير وحدة = عنوان مجموعة — السعر اتجاهل");
      price = null;
    } else if (!price) {
      price = null;
      w.push("مالوش سعر في العقد — أي فوترة عليه = C5");
    }
    if (workType && !WORK_TYPES.has(workType)) w.push(`نوع العمل "${workType}" مش من القايمة`);
    const ex = no ? dbItems.get(no) : undefined;
    if (ex) {
      const used = ex._count.aoItems + ex._count.invoiceLines;
      if (used && isGroup && !ex.isGroup) c.errors.push("البند عليه أوامر تكليف / مستخلصات — ماينفعش يتحول لعنوان");
      const oldPrice = ex.unitPrice == null ? null : Number(ex.unitPrice);
      if (ex._count.invoiceLines && oldPrice !== price) w.push(`السعر هيتغير من ${oldPrice ?? "—"} لـ ${price ?? "—"} والبند عليه مستخلصات`);
    }
    if (no) refs.push({ row: r.__row, itemNo: no });
    rows.push({
      sheet: BOQ,
      row: r.__row,
      status: c.errors.length ? "error" : ex ? "update" : "create",
      label: `${no || text(r.item_code)} ${description}`.slice(0, 120),
      errors: c.errors,
      warnings: w,
      data: {
        itemNo: no,
        parentNo: no ? parentOf(no) : null,
        isGroup,
        description,
        unit: isGroup ? null : unit,
        contractQty: isGroup ? null : qty,
        unitPrice: price,
        workType: isGroup ? null : workType,
        sortOrder: ++order,
      },
    });
  }
  const issues = checkBoqHierarchy(refs, new Set(dbItems.keys()));
  for (const r of rows) {
    const x = issues.get(r.row);
    if (!x) continue;
    r.errors.push(...x.errors);
    r.warnings.push(...x.warnings);
    if (x.errors.length) r.status = "error";
  }
  if (!rows.some((r) => r.status !== "skip") && !existing) errors.push("مفيش ولا بند في شيت المقايسة");

  const headRow: RowResult<Row> = {
    sheet: HEAD,
    row: 1,
    status: errors.length ? "error" : existing ? "update" : "create",
    label: `العقد ${contractNo || "—"} — ${company?.name ?? companyCode}`,
    errors,
    warnings,
  };
  if (errors.length) {
    for (const r of rows) {
      if (r.status === "create" || r.status === "update") {
        r.status = "skip";
        r.warnings.push("مش هيتحفظ لحد ما بيانات العقد تتصلح");
      }
    }
  }
  return { templateId: TEMPLATE_ID, rows: [headRow, ...rows], notes, header: header as unknown as Record<string, unknown> };
}

async function commit(preview: ImportPreview<Row>, tx: Prisma.TransactionClient): Promise<CommitResult> {
  if (!preview.rows.some((r) => r.sheet === HEAD)) throw new Error("contract header missing from valid rows");
  const { computeValue, awardDate, startDate, endDate, ...h } = preview.header as unknown as Header;
  const items = preview.rows.filter((r) => r.sheet === BOQ && r.data).map((r) => r.data!);
  const d = (s: string | null) => (s ? new Date(s) : null);
  const contractValue = computeValue ? computedValue(items) : h.contractValue;
  const contract = await upsertContract(tx, { ...h, contractValue, awardDate: d(awardDate), startDate: d(startDate), endDate: d(endDate) });

  const ids = new Map((await listContractItemIds(tx, contract.id)).map((i) => [i.itemNo, i.id]));
  const creates = items.filter((i) => !ids.has(i.itemNo));
  const updates = items.filter((i) => ids.has(i.itemNo)).map((i) => ({ ...i, id: ids.get(i.itemNo)! }));
  const created = await createContractItems(tx, contract.id, creates);
  const updated = await updateContractItems(tx, updates);
  const kept = ids.size - updates.length;
  return {
    message: `العقد ${h.contractNo}: ${created.count} بند جديد و${updated} بند اتحدث${kept ? ` — ${kept} بند مش في الملف فضلوا زي ما هم` : ""}`,
    counts: { created: created.count, updated, kept },
  };
}

/** قيمة العقد لو فاضية = Σ كمية العقد × السعر (null لو مفيش كميات) */
function computedValue(items: Row[]): number | null {
  let cents = 0;
  let any = false;
  for (const i of items) {
    if (i.isGroup || i.contractQty == null || i.unitPrice == null) continue;
    any = true;
    cents += Math.round(i.contractQty * i.unitPrice * 100);
  }
  return any ? cents / 100 : null;
}

registerImporter({
  templateId: TEMPLATE_ID,
  title: "العقد والمقايسة",
  templateFile: `${TEMPLATE_ID}.xlsx`,
  permission: "master.import",
  sheets: [
    { name: HEAD, kind: "kv" },
    { name: BOQ, kind: "table" },
  ],
  validate,
  commit,
} satisfies Importer<Row>);
