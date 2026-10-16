import "server-only";
import type { Prisma } from "@it/db";
import type { CommitResult, ImportPreview } from "@/features/imports/import.types";
import {
  createAo,
  createAoChange,
  createAoItems,
  createAoMaterials,
  deleteAoItems,
  deleteAoMaterials,
  ensureSites,
  getAoForUpdate,
  listAoItems,
  listAoMaterials,
  setAoItemQty,
  setAoMaterialQty,
  updateAo,
} from "./contracts.import.repo";

/** رأس أمر التكليف بعد الفحص — JSON-safe لأنه بيتخزن في ImportBatch.report */
export type AoHeader = {
  contractId: string;
  aoNo: string;
  rev: number;
  /** للملاحق: كميات الملف زيادة (add) ولا الإجمالي الجديد (replace). الأصلي دايماً replace للكل */
  mode: "add" | "replace";
  existingId: string | null;
  aoDate: string | null;
  name: string | null;
  projectId: string | null;
  value: number | null;
  increase: number | null;
  financialCommitment: number | null;
  planningAnnexValue: number | null;
  area: string | null;
  centralText: string | null;
  outOfScope: boolean | null;
  duration: string | null;
  finalGuaranteePct: number | null;
  stampsTotal: number | null;
};

export type AoRow =
  | { kind: "item"; contractItemId: string; site: string | null; qty: number }
  | { kind: "material"; materialId: string; qty: number };

type Tx = Prisma.TransactionClient;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** القيم اللي في الملف بس (null = سيب الموجود) */
function presentFields(h: AoHeader) {
  const all = {
    aoDate: h.aoDate ? new Date(h.aoDate) : null,
    name: h.name,
    projectId: h.projectId,
    value: h.value,
    planningAnnexValue: h.planningAnnexValue,
    area: h.area,
    centralText: h.centralText,
    outOfScope: h.outOfScope,
    duration: h.duration,
    finalGuaranteePct: h.finalGuaranteePct,
    stampsTotal: h.stampsTotal,
  };
  return Object.fromEntries(Object.entries(all).filter(([, v]) => v != null)) as { [K in keyof typeof all]?: NonNullable<(typeof all)[K]> };
}

export async function commitAo(preview: ImportPreview<AoRow>, tx: Tx, headSheet: string): Promise<CommitResult> {
  if (!preview.rows.some((r) => r.sheet === headSheet)) throw new Error("AO header missing from valid rows");
  const h = preview.header as unknown as AoHeader;
  const data = preview.rows.map((r) => r.data).filter((d): d is AoRow => d != null);
  const fields = presentFields(h);

  // ── أمر التكليف نفسه + الملاحق ──
  let aoId = h.existingId;
  let before: { value: number | null; fc: number | null } = { value: null, fc: null };
  if (aoId) {
    const cur = await getAoForUpdate(tx, aoId);
    before = { value: cur.value == null ? null : Number(cur.value), fc: cur.financialCommitment == null ? null : Number(cur.financialCommitment) };
    await updateAo(tx, aoId, { ...fields, ...(h.financialCommitment != null ? { financialCommitment: h.financialCommitment } : {}) });
  } else {
    const ao = await createAo(tx, h.contractId, h.aoNo, { ...fields, name: h.name ?? h.aoNo, financialCommitment: h.financialCommitment, status: "active" });
    aoId = ao.id;
  }
  let changes = 0;
  const changeDate = fields.aoDate ?? null;
  if (h.rev > 0) {
    const base = before.value ?? (h.value != null && h.increase != null ? h.value - h.increase : null);
    const increase = h.increase ?? (h.value != null && base != null ? h.value - base : null);
    await createAoChange(tx, { aoId, kind: "increase", changeDate, baseValue: base, increase, newTotal: h.value, reference: `ملحق ${h.rev}` });
    changes++;
  }
  if (h.existingId && h.financialCommitment != null && h.financialCommitment !== before.fc) {
    await createAoChange(tx, {
      aoId,
      kind: "commitment_renewal",
      changeDate,
      baseValue: before.fc,
      increase: before.fc == null ? null : h.financialCommitment - before.fc,
      newTotal: h.financialCommitment,
      reference: h.rev > 0 ? `مع ملحق ${h.rev}` : "تعزيز الارتباط المالي",
    });
    changes++;
  }

  // ── البنود والمواقع ──
  const items = data.filter((d) => d.kind === "item");
  const siteIds = await ensureSites(tx, aoId, [...new Set(items.map((i) => i.site).filter((s): s is string => !!s))]);
  const agg = new Map<string, { contractItemId: string; siteId: string | null; qty: number }>();
  for (const i of items) {
    const siteId = i.site ? siteIds.get(i.site)! : null;
    const k = `${i.contractItemId}|${siteId ?? ""}`;
    const a = agg.get(k) ?? { contractItemId: i.contractItemId, siteId, qty: 0 };
    a.qty += i.qty;
    agg.set(k, a);
  }
  let itemsWritten = 0;
  if (!items.length) {
    // ملف رأس بس — الكميات الموجودة ما تتلمسش
  } else if (h.rev === 0) {
    await deleteAoItems(tx, aoId);
    itemsWritten = (await createAoItems(tx, [...agg.values()].map((a) => ({ aoId: aoId!, contractItemId: a.contractItemId, siteId: a.siteId, plannedQty: round4(a.qty) })))).count;
  } else {
    const cur = new Map((await listAoItems(tx, aoId)).map((x) => [`${x.contractItemId}|${x.siteId ?? ""}`, x]));
    const fresh: Prisma.AoItemCreateManyInput[] = [];
    for (const [k, a] of agg) {
      const x = cur.get(k);
      if (!x) fresh.push({ aoId, contractItemId: a.contractItemId, siteId: a.siteId, plannedQty: round4(a.qty) });
      else await setAoItemQty(tx, x.id, round4(h.mode === "add" ? Number(x.plannedQty) + a.qty : a.qty));
    }
    itemsWritten = agg.size - fresh.length + (await createAoItems(tx, fresh)).count;
  }

  // ── المهمات ──
  const mats = data.filter((d) => d.kind === "material");
  let matsWritten = 0;
  if (mats.length) {
    if (h.rev === 0) {
      await deleteAoMaterials(tx, aoId);
      matsWritten = (await createAoMaterials(tx, mats.map((m) => ({ aoId: aoId!, materialId: m.materialId, plannedQty: round4(m.qty) })))).count;
    } else {
      const cur = new Map((await listAoMaterials(tx, aoId)).map((x) => [x.materialId, x]));
      const fresh: Prisma.AoMaterialCreateManyInput[] = [];
      for (const m of mats) {
        const x = cur.get(m.materialId);
        if (!x) fresh.push({ aoId, materialId: m.materialId, plannedQty: round4(m.qty) });
        else await setAoMaterialQty(tx, x.id, round4(h.mode === "add" ? Number(x.plannedQty) + m.qty : m.qty));
      }
      matsWritten = mats.length - fresh.length + (await createAoMaterials(tx, fresh)).count;
    }
  }

  const what = h.rev ? `ملحق رقم ${h.rev} على أمر التكليف ${h.aoNo}` : `أمر التكليف ${h.aoNo}`;
  return {
    message: `${what}: ${itemsWritten} بند في ${siteIds.size} موقع، و${matsWritten} صنف مهمات${changes ? `، وتم تسجيل ${changes} تعديل` : ""}`,
    counts: { items: itemsWritten, sites: siteIds.size, materials: matsWritten, changes },
  };
}
