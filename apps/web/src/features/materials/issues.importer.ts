import "server-only";
import { date, isExampleRow, num, text } from "@/features/imports/cells";
import type { Importer, RowResult } from "@/features/imports/import.types";
import { registerImporter } from "@/features/imports/registry";
import { aoScopeWhere, isUnscoped } from "./ao-scope";
import { materialCode, normalizeAoNo, normalizeContractNo } from "./material-keys";
import { aoIdsInScope, findMaterialsByCodes, issueContext, listAosOfContracts, listContractKeys, upsertIssue } from "./materials.repo";

/**
 * 08 المنصرف من المخازن — كل إذن صرف صف.
 * المفتاح المنطقي (أمر التكليف، الصنف، رقم الإذن): موجود ← تحديث، مش موجود ← جديد.
 */
const SHEET = "المنصرف";

/** التواريخ بتتخزن ISO في المعاينة (JSON) وبتتحوّل Date في الحفظ */
type Row = { aoId: string; materialId: string; issueRef: string; qty: number; returnedQty: number; issueDate: string };

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export const issuesImporter: Importer<Row> = {
  templateId: "08_المنصرف_من_المخازن",
  title: "المنصرف من المخازن",
  templateFile: "08_المنصرف_من_المخازن.xlsx",
  permission: "issues.import",
  sheets: [{ name: SHEET, kind: "table" }],

  async validate(wb, ctx) {
    const sheet = wb.sheets[SHEET];
    const raw = sheet?.kind === "table" ? sheet.rows.filter((r) => !isExampleRow(r)) : [];

    // ── قراءة المراجع مرة واحدة ──
    const contracts = new Map((await listContractKeys()).map((c) => [normalizeContractNo(c.contractNo), c]));
    const usedContracts = [...new Set(raw.map((r) => contracts.get(normalizeContractNo(r.contract_no))?.id).filter((x): x is string => !!x))];
    const aos = await listAosOfContracts(usedContracts);
    const aoByKey = new Map(aos.map((a) => [`${a.contractId}|${normalizeAoNo(a.aoNo)}`, a]));
    const scope = aoScopeWhere(ctx.user);
    const inScope = isUnscoped(scope) ? null : await aoIdsInScope(aos.map((a) => a.id), scope);
    const materials = new Map(
      (await findMaterialsByCodes([...new Set(raw.map((r) => materialCode(r.material_code)).filter(Boolean))])).map((m) => [m.code, m]),
    );
    const [existingIssues, planned] = await issueContext(aos.map((a) => a.id), [...materials.values()].map((m) => m.id));
    const existingKey = new Map(existingIssues.map((x) => [`${x.aoId}|${x.materialId}|${x.issueRef}`, x]));
    const plannedBy = new Map(planned.map((p) => [`${p.aoId}|${p.materialId}`, Number(p.plannedQty)]));
    // المنصرف الصافي الموجود لكل (أمر تكليف، صنف) — عشان تحذير "أكبر من المخطط"
    const netBy = new Map<string, number>();
    for (const x of existingIssues) {
      const k = `${x.aoId}|${x.materialId}`;
      netBy.set(k, (netBy.get(k) ?? 0) + Number(x.qty) - Number(x.returnedQty));
    }

    const today = new Date().toISOString().slice(0, 10);
    const seen = new Map<string, number>();

    const rows = raw.map((r): RowResult<Row> => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const contractNo = normalizeContractNo(r.contract_no);
      const aoNo = normalizeAoNo(r.ao_no);
      const code = materialCode(r.material_code);
      const issueRef = text(r.issue_ref);
      const label = `${aoNo || "—"} · ${code || "—"} · ${issueRef || "—"}`;

      const contract = contracts.get(contractNo);
      if (!contractNo) errors.push("رقم العقد إلزامي");
      else if (!contract) errors.push(`العقد ${contractNo} مش متسجل`);
      const ao = contract ? aoByKey.get(`${contract.id}|${aoNo}`) : undefined;
      if (contract && !aoNo) errors.push("رقم أمر التكليف إلزامي");
      else if (contract && !ao) errors.push(`أمر التكليف ${aoNo} مش على العقد ${contractNo}`);
      if (ao && inScope && !inScope.has(ao.id)) errors.push("أمر التكليف ده خارج نطاقك");

      const material = materials.get(code);
      if (!code) errors.push("رقم الشطب إلزامي");
      else if (!material) errors.push(`الصنف ${code} مش في كتالوج المهمات — ارفعه في قالب 07 الأول`);

      const qty = num(r.qty, "الكمية المنصرفة");
      const ret = num(r.returned_qty, "الكمية المرتجعة", { min: 0 });
      if (qty.error) errors.push(qty.error);
      else if (qty.value == null || qty.value <= 0) errors.push("الكمية المنصرفة لازم تكون أكبر من صفر");
      if (ret.error) errors.push(ret.error);
      const q = qty.value ?? 0;
      const rq = ret.value ?? 0;
      if (!qty.error && !ret.error && rq > q) errors.push("الكمية المرتجعة أكبر من المنصرفة");

      const d = date(r.issue_date, "تاريخ الصرف");
      if (d.error) errors.push(d.error);
      else if (!d.value) errors.push("تاريخ الصرف إلزامي");
      else if (d.value.toISOString().slice(0, 10) > today) warnings.push("تاريخ الصرف في المستقبل");

      if (!issueRef) errors.push("رقم إذن الصرف إلزامي");

      if (ao && material && issueRef) {
        const k = `${ao.id}|${material.id}|${issueRef}`;
        const first = seen.get(k);
        if (first) errors.push(`نفس إذن الصرف لنفس الصنف متكرر في الملف (صف ${first})`);
        else seen.set(k, r.__row);
      }

      if (errors.length) return { sheet: SHEET, row: r.__row, status: "error", label, errors, warnings };

      const pk = `${ao!.id}|${material!.id}`;
      const prev = existingKey.get(`${pk}|${issueRef}`);
      const net = (netBy.get(pk) ?? 0) - (prev ? Number(prev.qty) - Number(prev.returnedQty) : 0) + q - rq;
      netBy.set(pk, net);
      const plan = plannedBy.get(pk);
      if (!plan) warnings.push("الصنف ده مش مخطط في أمر التكليف");
      else if (net > plan * 1.1) warnings.push(`المنصرف التراكمي ${round4(net)} أكبر من المخطط ${round4(plan)} ${material!.unit}`);

      return {
        sheet: SHEET,
        row: r.__row,
        status: prev ? "update" : "create",
        label: `${label} — ${material!.description}`,
        errors,
        warnings,
        data: { aoId: ao!.id, materialId: material!.id, issueRef, qty: q, returnedQty: rq, issueDate: d.value!.toISOString() },
      };
    });

    return { templateId: issuesImporter.templateId, rows, notes: rows.length ? [] : ["مفيش صفوف في شيت المنصرف"] };
  },

  async commit(preview, tx) {
    const counts = { created: 0, updated: 0 };
    for (const r of preview.rows) {
      if (!r.data) continue;
      const res = await upsertIssue(tx, { ...r.data, issueDate: new Date(r.data.issueDate) });
      if (res === "create") counts.created++;
      else counts.updated++;
    }
    return { message: `اتسجل ${counts.created} إذن صرف جديد و${counts.updated} إذن اتحدّث`, counts };
  },
};

registerImporter(issuesImporter);
