import "server-only";
import { date, isExampleRow, num, required, text } from "@/features/imports/cells";
import type { Importer, RowResult } from "@/features/imports/import.types";
import { registerImporter } from "@/features/imports/registry";
import { aoScopeWhere, isUnscoped } from "@/features/materials/ao-scope";
import { normalizeAoNo, normalizeContractNo } from "@/features/materials/material-keys";
import { aoIdsInScope } from "@/features/materials/materials.repo";
import { inferWorkTypeCode, mapStepName, UNKNOWN_STEP_STATE, type MigratedState } from "./history.mapping";
import {
  createMigratedInvoice,
  ensurePendingAo,
  findInvoiceByNo,
  listAosForHistory,
  listContractsForHistory,
  listExistingInvoices,
  listWorkTypesForHistory,
  updateMigratedStatus,
  type LogEntry,
} from "./history.repo";

/**
 * 11 المستخلصات السابقة — ترحيل من ملفات الموقف (مرة واحدة عند التشغيل).
 * المستخلص بيتعمل migrated=true من غير بنود، وبسطر واحد في سجل الحركة.
 * الرفع تاني لنفس (العقد، رقم المستخلص) بيحدّث الحالة بس.
 */
const SHEET = "المستخلصات";

type Row = MigratedState & {
  contractId: string;
  /** null = أمر التكليف مش متسجل وهيتعمل pending_approval */
  aoId: string | null;
  aoNo: string;
  invoiceNo: string;
  pathName: string;
  /** نوع الأعمال المستنتج من اسم المسار — null لو الكود مش متسجل في أنواع الأعمال */
  workTypeId: string | null;
  amountExcl: number;
  amountIncl: number | null;
  /** ISO — المعاينة بتتخزن JSON */
  since: string | null;
  paymentRef: string | null;
  holder: string;
  notes: string;
  existingId: string | null;
};

export const historyImporter: Importer<Row> = {
  templateId: "11_المستخلصات_السابقة",
  title: "ترحيل المستخلصات الحالية",
  templateFile: "11_المستخلصات_السابقة.xlsx",
  permission: "invoice.override",
  sheets: [{ name: SHEET, kind: "table" }],

  async validate(wb, ctx) {
    const sheet = wb.sheets[SHEET];
    const raw = sheet?.kind === "table" ? sheet.rows.filter((r) => !isExampleRow(r)) : [];

    const contracts = new Map((await listContractsForHistory()).map((c) => [normalizeContractNo(c.contractNo), c]));
    const contractIds = [...new Set(raw.map((r) => contracts.get(normalizeContractNo(r.contract_no))?.id).filter((x): x is string => !!x))];
    const aos = await listAosForHistory(contractIds);
    const aoByKey = new Map(aos.map((a) => [`${a.contractId}|${normalizeAoNo(a.aoNo)}`, a]));
    const scope = aoScopeWhere(ctx.user);
    const inScope = isUnscoped(scope) ? null : await aoIdsInScope(aos.map((a) => a.id), scope);
    const existing = new Map(
      (await listExistingInvoices(contractIds, [...new Set(raw.map((r) => text(r.invoice_no)).filter(Boolean))])).map((i) => [`${i.contractId}|${i.invoiceNo}`, i]),
    );
    const workTypes = new Map((await listWorkTypesForHistory()).map((w) => [w.code, w.id]));
    const seen = new Map<string, number>();

    const rows = raw.map((r): RowResult<Row> => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const contractNo = normalizeContractNo(r.contract_no);
      const aoNo = normalizeAoNo(r.ao_no);
      const invoiceNo = text(r.invoice_no);
      const path = required(r.path_name, "اسم المسار");
      const label = `${contractNo || "—"} · ${aoNo || "—"} · مستخلص ${invoiceNo || "—"} ${path.value ?? ""}`.trim();

      const contract = contracts.get(contractNo);
      if (!contractNo) errors.push("رقم العقد إلزامي");
      else if (!contract) errors.push(`العقد ${contractNo} مش متسجل — ارفع العقد (قالب 05) الأول`);
      if (!aoNo) errors.push("رقم أمر التكليف إلزامي");
      if (!invoiceNo) errors.push("رقم المستخلص إلزامي");
      if (path.error) errors.push(path.error);
      const workTypeCode = inferWorkTypeCode(path.value ?? "");
      const workTypeId = workTypes.get(workTypeCode) ?? null;
      if (path.value && !workTypeId) warnings.push(`نوع الأعمال ${workTypeCode} مش متسجل — المستخلص هيتسجل من غير نوع أعمال`);

      // ── المحطة ← الحالة ──
      const stepName = text(r.current_step);
      let state: MigratedState;
      if (!stepName) {
        errors.push("المحطة الحالية إلزامية");
        state = { ...UNKNOWN_STEP_STATE };
      } else {
        const mapped = mapStepName(stepName);
        if (!mapped) warnings.push(`المحطة "${stepName}" مش معروفة — هيتسجل جاري عند مشرف التنفيذ`);
        state = mapped ?? { ...UNKNOWN_STEP_STATE };
      }

      // ── المبالغ ──
      const excl = num(r.amount_excl_vat, "المبلغ غير شامل", { min: 0 });
      const incl = num(r.amount_incl_vat, "المبلغ شامل", { min: 0 });
      if (excl.error) errors.push(excl.error);
      else if (excl.value == null) errors.push("المبلغ غير شامل إلزامي");
      if (incl.error) errors.push(incl.error);
      if (excl.value != null && incl.value != null && incl.value + 0.01 < excl.value) warnings.push("المبلغ الشامل أقل من غير الشامل");

      const since = date(r.since_date, "في المحطة من تاريخ");
      if (since.error) errors.push(since.error);
      else if (!since.value && (state.status === "active" || state.status === "on_hold")) {
        warnings.push("تاريخ المحطة فاضي — عداد الـ SLA هيبدأ من يوم الرفع");
      }

      // ── أمر التكليف ──
      const ao = contract && aoNo ? aoByKey.get(`${contract.id}|${aoNo}`) : undefined;
      if (contract && aoNo && !ao) {
        if (state.status === "on_hold" || state.status === "draft") {
          warnings.push(`أمر التكليف ${aoNo} مش متسجل — هيتعمل بحالة "بانتظار الاعتماد" باسم المسار`);
        } else {
          errors.push(`أمر التكليف ${aoNo} مش على العقد ${contractNo} — ارفعه (قالب 06) الأول`);
        }
      }
      if (ao && inScope && !inScope.has(ao.id)) errors.push("أمر التكليف ده خارج نطاقك");
      // أمر تكليف لسه بانتظار الاعتماد (غالباً اتعمل من ترحيل سابق) — بس المعلّق والمسودة يتربطوا بيه،
      // عشان نتيجة الرفع ما تتغيرش لو نفس الملف اترفع مرتين
      if (ao && ao.status === "pending_approval" && state.status !== "on_hold" && state.status !== "draft") {
        errors.push(`أمر التكليف ${aoNo} لسه بانتظار الاعتماد — ارفع بياناته (قالب 06) الأول`);
      }

      // ── تكرار / موجود قبل كده ──
      const prev = contract && invoiceNo ? existing.get(`${contract.id}|${invoiceNo}`) : undefined;
      if (contract && invoiceNo) {
        const k = `${contract.id}|${invoiceNo}`;
        const first = seen.get(k);
        if (first) errors.push(`رقم المستخلص ${invoiceNo} متكرر على نفس العقد (صف ${first})`);
        else seen.set(k, r.__row);
      }
      if (prev && !prev.migrated) {
        return { sheet: SHEET, row: r.__row, status: "skip", label, errors, warnings: [...warnings, "المستخلص ده متسجل في المنظومة (مش مرحّل) — مش هيتعدّل من الترحيل"] };
      }
      if (prev && ao && prev.aoId !== ao.id) warnings.push("المستخلص متسجل على أمر تكليف تاني — هتتحدث الحالة بس");

      if (errors.length) return { sheet: SHEET, row: r.__row, status: "error", label, errors, warnings };
      const paymentRef = text(r.payment_ref) || null;
      if (prev) {
        const same =
          prev.status === state.status &&
          (prev.currentStep ?? null) === state.currentStep &&
          (!since.value || prev.since.getTime() === since.value.getTime()) &&
          (prev.paymentRef ?? null) === paymentRef;
        if (same) return { sheet: SHEET, row: r.__row, status: "skip", label, errors, warnings: [...warnings, "مفيش تغيير عن المتسجل"] };
      }

      return {
        sheet: SHEET,
        row: r.__row,
        status: prev ? "update" : "create",
        label,
        errors,
        warnings,
        data: {
          ...state,
          contractId: contract!.id,
          aoId: ao?.id ?? null,
          aoNo,
          invoiceNo,
          pathName: path.value!,
          workTypeId,
          amountExcl: excl.value!,
          amountIncl: incl.value ?? null,
          since: since.value?.toISOString() ?? null,
          paymentRef,
          holder: text(r.holder_name),
          notes: text(r.notes),
          existingId: prev?.id ?? null,
        },
      };
    });

    const notes: string[] = [];
    if (!rows.length) notes.push("مفيش صفوف في شيت المستخلصات");
    const toCreate = new Set(rows.filter((r) => r.data && !r.data.aoId).map((r) => `${r.data!.contractId}|${r.data!.aoNo}`));
    if (toCreate.size) notes.push(`هيتعمل ${toCreate.size} أمر تكليف بحالة "بانتظار الاعتماد" للمستخلصات المعلّقة — الشئون الفنية تكمّل بياناتها من قالب 06.`);
    return { templateId: historyImporter.templateId, rows, notes };
  },

  async commit(preview, tx, ctx) {
    const counts = { created: 0, updated: 0, unchanged: 0, aosCreated: 0 };
    const aoCache = new Map<string, string>();
    const now = new Date();

    for (const r of preview.rows) {
      const d = r.data;
      if (!d) continue;

      let aoId = d.aoId;
      if (!aoId) {
        const k = `${d.contractId}|${d.aoNo}`;
        aoId = aoCache.get(k) ?? null;
        if (!aoId) {
          const res = await ensurePendingAo(tx, d.contractId, d.aoNo, d.pathName);
          if (res.created) counts.aosCreated++;
          aoId = res.id;
          aoCache.set(k, aoId);
        }
      }

      const since = d.since ? new Date(d.since) : null;
      const paid = d.status === "paid";
      const base = d.holder ? `مرحّل من ملف الموقف — الماسك: ${d.holder}` : "مرحّل من ملف الموقف";
      const note = d.notes ? `${base} | ${d.notes}` : base;
      const fields = {
        status: d.status,
        currentStep: d.currentStep,
        heldAt: d.heldAt,
        holdReason: d.holdReason,
        // تاريخ الصرف مش معروف لو الخانة فاضية — أحسن من تاريخ وهمي في التقارير
        paidAt: paid ? since : null,
        paymentRef: d.paymentRef,
      };

      // ممكن يكون اتعمل بعد المعاينة — بنتأكد تاني جوه الـ transaction
      const ex = await findInvoiceByNo(tx, d.contractId, d.invoiceNo);
      if (ex) {
        if (!ex.migrated) continue;
        const changed = ex.status !== d.status || (ex.currentStep ?? null) !== d.currentStep;
        const log: LogEntry | null = changed
          ? { action: paid ? "pay" : "approve", toStep: d.currentStep, note: note.replace("مرحّل من", "تحديث من"), at: since ?? now, byId: ctx.user.id }
          : null;
        await updateMigratedStatus(tx, ex.id, { ...fields, ...(since || changed ? { since: since ?? now } : {}) }, log);
        if (changed || since) counts.updated++;
        else counts.unchanged++;
        continue;
      }

      await createMigratedInvoice(
        tx,
        {
          ...fields,
          since: since ?? now,
          contractId: d.contractId,
          aoId,
          invoiceNo: d.invoiceNo,
          pathName: d.pathName,
          workTypeId: d.workTypeId,
          migratedAmount: d.amountExcl,
          paymentAmount: paid ? (d.amountIncl ?? d.amountExcl) : null,
          submittedAt: d.status === "draft" ? null : since,
          createdById: ctx.user.id,
        },
        { action: paid ? "pay" : "submit", toStep: d.currentStep, note, at: since ?? now, byId: ctx.user.id },
      );
      counts.created++;
    }

    const parts = [`اترحّل ${counts.created} مستخلص جديد`, `واتحدّثت حالة ${counts.updated}`];
    if (counts.aosCreated) parts.push(`واتعمل ${counts.aosCreated} أمر تكليف بانتظار الاعتماد`);
    return { message: parts.join(" "), counts };
  },
};

registerImporter(historyImporter);
