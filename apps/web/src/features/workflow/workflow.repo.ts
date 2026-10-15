import "server-only";
import { prisma, type DocStage, type Prisma } from "@it/db";
import type { CategoryStepRow } from "./workflow.rules";

/** الوصول للداتا الخاص بإعدادات المسار — الطبقة الوحيدة هنا اللي بتكلم Prisma */

type Audit = { userId: string; action: string; entity: string; entityId?: string | null; details?: Prisma.InputJsonValue };

// ── المسار والـ SLA ─────────────────────────────────────

export function listSteps() {
  return prisma.workflowStep.findMany({ orderBy: [{ sort: "asc" }, { key: "asc" }], select: { key: true, name: true, short: true, role: true, sort: true } });
}

export function listCategoriesWithSteps() {
  return prisma.category.findMany({
    orderBy: { code: "asc" },
    select: { code: true, name: true, steps: { orderBy: { seq: "asc" }, select: { stepKey: true, slaDays: true } } },
  });
}

/**
 * مستخلصات واقفة دلوقتي على المحطات دي في الفئة دي (جاري / مرتجع ليها / معلّق عندها).
 * الفئة الفعلية = المعتمدة، ولو مش موجودة المقترحة، وإلا C1 (زي effectiveCategory في @it/domain).
 */
export function countStuckInvoices(category: string, stepKeys: string[]) {
  if (stepKeys.length === 0) return Promise.resolve(0);
  const inCategory: Prisma.InvoiceWhereInput[] = [{ category }, { category: null, suggestedCategory: category }];
  if (category === "C1") inCategory.push({ category: null, suggestedCategory: null });
  return prisma.invoice.count({
    where: {
      AND: [
        { OR: inCategory },
        {
          OR: [
            { status: "active", currentStep: { in: stepKeys } },
            { status: "returned", returnTo: { in: stepKeys } },
            { status: "on_hold", heldAt: { in: stepKeys } },
          ],
        },
      ],
    },
  });
}

/** بيكتب مسار كل فئة متغيرة من جديد — كله في transaction واحدة */
export function replaceCategorySteps(changes: { category: string; rows: CategoryStepRow[] }[], audit: Audit) {
  return prisma.$transaction(async (tx) => {
    for (const c of changes) {
      await tx.categoryStep.deleteMany({ where: { categoryCode: c.category } });
      await tx.categoryStep.createMany({ data: c.rows });
    }
    await tx.auditLog.create({ data: audit });
  });
}

// ── أسباب الإرجاع ───────────────────────────────────────

export function listReturnReasons() {
  return prisma.returnReason.findMany({
    orderBy: [{ sort: "asc" }, { name: "asc" }],
    select: { id: true, name: true, active: true, sort: true, _count: { select: { usedIn: true } } },
  });
}

export function createReturnReason(name: string, audit: Audit) {
  return prisma.$transaction(async (tx) => {
    const max = await tx.returnReason.aggregate({ _max: { sort: true } });
    const r = await tx.returnReason.create({ data: { name, sort: (max._max.sort ?? -1) + 1 }, select: { id: true } });
    await tx.auditLog.create({ data: { ...audit, entityId: r.id } });
  });
}

export function updateReturnReason(id: string, data: { name?: string; active?: boolean }, audit: Audit) {
  return prisma.$transaction([prisma.returnReason.update({ where: { id }, data, select: { id: true } }), prisma.auditLog.create({ data: audit })]);
}

export function countReasonUsage(id: string) {
  return prisma.stepLogReason.count({ where: { reasonId: id } });
}

export function deleteReturnReason(id: string, audit: Audit) {
  return prisma.$transaction([prisma.returnReason.deleteMany({ where: { id } }), prisma.auditLog.create({ data: audit })]);
}

/** ترتيب جديد للأسباب (القايمة كلها بالـ ids بالترتيب) */
export function reorderReturnReasons(ids: string[], audit: Audit) {
  return prisma.$transaction([
    ...ids.map((id, sort) => prisma.returnReason.update({ where: { id }, data: { sort }, select: { id: true } })),
    prisma.auditLog.create({ data: audit }),
  ]);
}

// ── المستندات الإلزامية ─────────────────────────────────

export async function getDocsMatrix() {
  const [docTypes, projectTypes, required] = await Promise.all([
    prisma.docType.findMany({ orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.projectType.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.requiredDoc.findMany({ select: { projectTypeId: true, docTypeId: true, stage: true } }),
  ]);
  return { docTypes, projectTypes, required };
}

export function findDocTypeByCode(code: string) {
  return prisma.docType.findUnique({ where: { code }, select: { id: true } });
}

export function upsertDocType(input: { id?: string; code: string; name: string }, audit: Audit) {
  return prisma.$transaction(async (tx) => {
    const d = input.id
      ? await tx.docType.update({ where: { id: input.id }, data: { code: input.code, name: input.name }, select: { id: true } })
      : await tx.docType.create({ data: { code: input.code, name: input.name }, select: { id: true } });
    await tx.auditLog.create({ data: { ...audit, entityId: d.id } });
  });
}

export function setRequiredDoc(key: { projectTypeId: string; docTypeId: string; stage: DocStage }, on: boolean, audit: Audit) {
  return prisma.$transaction([
    on ? prisma.requiredDoc.createMany({ data: [key], skipDuplicates: true }) : prisma.requiredDoc.deleteMany({ where: key }),
    prisma.auditLog.create({ data: audit }),
  ]);
}

// ── الأجازات ────────────────────────────────────────────

export function listHolidays() {
  return prisma.holiday.findMany({ orderBy: { date: "asc" }, select: { date: true, name: true } });
}

export function findHolidays(dates: Date[]) {
  return prisma.holiday.findMany({ where: { date: { in: dates } }, select: { date: true, name: true } });
}

export function upsertHoliday(date: Date, name: string, audit: Audit) {
  return prisma.$transaction([
    prisma.holiday.upsert({ where: { date }, create: { date, name }, update: { name }, select: { date: true } }),
    prisma.auditLog.create({ data: audit }),
  ]);
}

/** من الاستيراد — جوه transaction المحرك */
export async function upsertHolidaysTx(tx: Prisma.TransactionClient, rows: { date: Date; name: string }[]) {
  for (const r of rows) {
    await tx.holiday.upsert({ where: { date: r.date }, create: r, update: { name: r.name }, select: { date: true } });
  }
}

export function deleteHoliday(date: Date, audit: Audit) {
  return prisma.$transaction([prisma.holiday.deleteMany({ where: { date } }), prisma.auditLog.create({ data: audit })]);
}

// ── الإعدادات ───────────────────────────────────────────

export async function getSettings(): Promise<Record<string, unknown>> {
  const rows = await prisma.setting.findMany({ select: { key: true, value: true } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function saveSettings(values: Record<string, Prisma.InputJsonValue>, audit: Audit) {
  return prisma.$transaction([
    ...Object.entries(values).map(([key, value]) => prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value }, select: { key: true } })),
    prisma.auditLog.create({ data: audit }),
  ]);
}
