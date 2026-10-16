import "server-only";
import type { DocStage, Role } from "@it/db";
import { cache } from "react";
import type { SessionUser } from "@/features/auth/auth.types";
import { can } from "@/features/auth/permissions";
import { AppError } from "@/lib/errors";
import * as repo from "./workflow.repo";
import {
  cellsFromRows,
  matrixToCategorySteps,
  pathSteps,
  readSettings,
  removedSteps,
  sameCells,
  totalSla,
  validateCells,
  type CategoryCells,
  type EditableSettings,
  type SlaMatrix,
  type StepMeta,
} from "./workflow.rules";

async function assertConfig(actor: SessionUser) {
  if (!(await can(actor, "workflow.config"))) throw new AppError("FORBIDDEN");
}

const audit = (actor: SessionUser, action: string, entity: string, extra: { entityId?: string; details?: object } = {}) => ({
  userId: actor.id,
  action,
  entity,
  entityId: extra.entityId ?? null,
  details: extra.details as never,
});

const getSteps = cache(repo.listSteps);

/** المحطات اللي كل دور بيعتمد فيها (للشرح في شاشة المستخدمين) */
export async function getStepsByRole(): Promise<Partial<Record<Role, string[]>>> {
  const out: Partial<Record<Role, string[]>> = {};
  for (const s of pathSteps(await getSteps())) (out[s.role as Role] ??= []).push(s.short);
  return out;
}

// ── المسار والـ SLA ─────────────────────────────────────

export type PathConfig = { steps: StepMeta[]; categories: { code: string; name: string; cells: CategoryCells; total: number }[] };

export async function getPathConfig(actor: SessionUser): Promise<PathConfig> {
  await assertConfig(actor);
  const [steps, cats] = await Promise.all([getSteps(), repo.listCategoriesWithSteps()]);
  return {
    steps: pathSteps(steps),
    categories: cats.map((c) => {
      const cells = cellsFromRows(c.steps);
      return { code: c.code, name: c.name, cells, total: totalSla(cells) };
    }),
  };
}

/**
 * حفظ المصفوفة: الفئات اللي اتغيرت بس، وكل فئة مسارها بيتكتب من جديد بترتيب WorkflowStep.sort.
 * ممنوع تشيل محطة عليها مستخلصات واقفة دلوقتي في نفس الفئة.
 */
export async function savePaths(actor: SessionUser, matrix: SlaMatrix): Promise<{ changed: string[] }> {
  await assertConfig(actor);
  const [steps, cats] = await Promise.all([getSteps(), repo.listCategoriesWithSteps()]);
  const changes: { category: string; rows: ReturnType<typeof matrixToCategorySteps> }[] = [];
  const details: Record<string, string> = {};

  for (const [code, cells] of Object.entries(matrix)) {
    const current = cats.find((c) => c.code === code);
    if (!current) throw new AppError("VALIDATION", `فئة غير معروفة: ${code}`);
    const before = cellsFromRows(current.steps);
    if (sameCells(before, cells)) continue;
    const err = validateCells(code, cells, steps);
    if (err) throw new AppError("VALIDATION", err);
    const gone = removedSteps(before, cells);
    const stuck = await repo.countStuckInvoices(code, gone);
    if (stuck > 0) {
      const names = gone.map((k) => steps.find((s) => s.key === k)?.short ?? k).join("، ");
      throw new AppError("CONFLICT", `لا يمكن إزالة (${names}) من مسار الفئة ${code} — توجد ${stuck} مستخلصات قيد المراجعة عليها حالياً`);
    }
    const rows = matrixToCategorySteps(code, cells, steps);
    changes.push({ category: code, rows });
    details[code] = rows.map((r) => `${r.stepKey}:${r.slaDays ?? "-"}`).join(" ");
  }
  if (changes.length) await repo.replaceCategorySteps(changes, audit(actor, "workflow.paths", "category_steps", { details }));
  return { changed: changes.map((c) => c.category) };
}

// ── أسباب الإرجاع ───────────────────────────────────────

export async function getReturnReasons(actor: SessionUser) {
  await assertConfig(actor);
  const rows = await repo.listReturnReasons();
  return rows.map(({ _count, ...r }) => ({ ...r, used: _count.usedIn }));
}

export async function addReturnReason(actor: SessionUser, name: string) {
  await assertConfig(actor);
  await repo.createReturnReason(name, audit(actor, "returnReason.create", "return_reason", { details: { name } }));
}

export async function updateReturnReason(actor: SessionUser, id: string, data: { name?: string; active?: boolean }) {
  await assertConfig(actor);
  await repo.updateReturnReason(id, data, audit(actor, "returnReason.update", "return_reason", { entityId: id, details: data }));
}

/** المسح للأسباب اللي عمرها ما اتستخدمت بس — المستخدم يتقفل (active=false) عشان السجل يفضل سليم */
export async function deleteReturnReason(actor: SessionUser, id: string) {
  await assertConfig(actor);
  const used = await repo.countReasonUsage(id);
  if (used > 0) throw new AppError("CONFLICT", `هذا السبب مستخدم في ${used} إجراء — يرجى تعطيله بدلاً من حذفه`);
  await repo.deleteReturnReason(id, audit(actor, "returnReason.delete", "return_reason", { entityId: id }));
}

export async function moveReturnReason(actor: SessionUser, id: string, dir: -1 | 1) {
  await assertConfig(actor);
  const ids = (await repo.listReturnReasons()).map((r) => r.id);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  await repo.reorderReturnReasons(ids, audit(actor, "returnReason.reorder", "return_reason", { entityId: id }));
}

// ── المستندات الإلزامية ─────────────────────────────────

export async function getDocsMatrix(actor: SessionUser) {
  await assertConfig(actor);
  return repo.getDocsMatrix();
}

export async function saveDocType(actor: SessionUser, input: { id?: string; code: string; name: string }) {
  await assertConfig(actor);
  const same = await repo.findDocTypeByCode(input.code);
  if (same && same.id !== input.id) throw new AppError("CONFLICT", "هذا الكود مستخدم لمستند آخر");
  await repo.upsertDocType(input, audit(actor, input.id ? "docType.update" : "docType.create", "doc_type", { details: input }));
}

export async function setRequiredDoc(actor: SessionUser, key: { projectTypeId: string; docTypeId: string; stage: DocStage }, on: boolean) {
  await assertConfig(actor);
  await repo.setRequiredDoc(key, on, audit(actor, on ? "requiredDoc.add" : "requiredDoc.remove", "required_doc", { details: key }));
}

// ── الأجازات ────────────────────────────────────────────

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** تاريخ النهارده (yyyy-mm-dd) بتوقيت القاهرة — السيرفر UTC */
export function todayCairo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
}
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);

export async function getHolidays(actor: SessionUser) {
  await assertConfig(actor);
  return (await repo.listHolidays()).map((h) => ({ date: iso(h.date), name: h.name }));
}

export async function addHoliday(actor: SessionUser, date: string, name: string) {
  await assertConfig(actor);
  const d = toDate(date);
  if (Number.isNaN(d.getTime()) || iso(d) !== date) throw new AppError("VALIDATION", "التاريخ غير صحيح");
  const existing = await repo.findHolidays([d]);
  if (existing.length) throw new AppError("CONFLICT", `هذا اليوم مسجل عطلةً رسمية من قبل (${existing[0]!.name})`);
  await repo.upsertHoliday(d, name, audit(actor, "holiday.create", "holiday", { entityId: date, details: { name } }));
}

export async function removeHoliday(actor: SessionUser, date: string) {
  await assertConfig(actor);
  await repo.deleteHoliday(toDate(date), audit(actor, "holiday.delete", "holiday", { entityId: date }));
}

// ── الإعدادات ───────────────────────────────────────────

export async function getSettingsView(actor: SessionUser): Promise<EditableSettings> {
  await assertConfig(actor);
  return readSettings(await repo.getSettings());
}

export async function saveSettings(actor: SessionUser, values: EditableSettings) {
  await assertConfig(actor);
  await repo.saveSettings({ ...values }, audit(actor, "settings.update", "settings", { details: values }));
}
