// seed البيانات المرجعية — بيتشغّل مع كل deploy (خدمة migrate)، فلازم يبقى:
//  - idempotent: تشغيله مرتين = نفس النتيجة.
//  - مايمسحش تعديلات الـ Admin: أي حاجة قابلة للتعديل من الشاشات (SLA، المسار، الصلاحيات،
//    المستندات الإلزامية، الإعدادات) بتتزرع بس لو مش موجودة، وعمرها ما بتتكتب فوقها.
import type { PrismaClient } from '../../src/index';
import {
  CATEGORIES, DOC_TYPES, HOLIDAYS_2026, PERMISSIONS, PROJECT_TYPES, REQUIRED_FINANCE_DOCS,
  REQUIRED_SUBMIT_DOCS, RETURN_REASONS, SETTINGS, WORKFLOW_STEPS,
} from './reference-data';

export async function seedReference(db: PrismaClient): Promise<void> {
  await seedSteps(db);
  await seedCategories(db);
  await seedDocs(db);
  await seedReturnReasons(db);
  await seedHolidays(db);
  await seedPermissions(db);
  await seedSettings(db);
}

async function seedSteps(db: PrismaClient) {
  for (const [sort, s] of WORKFLOW_STEPS.entries()) {
    await db.workflowStep.upsert({
      where: { key: s.key },
      create: { ...s, sort },
      update: {},
    });
  }
  log('workflow_steps', WORKFLOW_STEPS.length);
}

/** المسار بيتزرع بس للفئة اللي مالهاش محطات — لو الـ Admin عدّل المسار يفضل زي ما هو */
async function seedCategories(db: PrismaClient) {
  let seeded = 0;
  for (const c of CATEGORIES) {
    await db.category.upsert({ where: { code: c.code }, create: { code: c.code, name: c.name }, update: {} });
    const existing = await db.categoryStep.count({ where: { categoryCode: c.code } });
    if (existing > 0) continue;
    await db.categoryStep.createMany({
      data: c.path.map(([stepKey, slaDays], i) => ({ categoryCode: c.code, stepKey, seq: i + 1, slaDays })),
    });
    seeded++;
  }
  log('categories', CATEGORIES.length, `${seeded} path(s) seeded`);
}

async function seedDocs(db: PrismaClient) {
  const docIds = new Map<string, string>();
  for (const d of DOC_TYPES) {
    const row = await db.docType.upsert({ where: { code: d.code }, create: d, update: {} });
    docIds.set(d.code, row.id);
  }
  log('doc_types', DOC_TYPES.length);

  let seeded = 0;
  for (const t of PROJECT_TYPES) {
    const type = await db.projectType.upsert({ where: { code: t.code }, create: t, update: {} });
    const plan = [
      { stage: 'submit' as const, codes: REQUIRED_SUBMIT_DOCS[t.code] ?? [] },
      { stage: 'finance' as const, codes: REQUIRED_FINANCE_DOCS },
    ];
    for (const { stage, codes } of plan) {
      const existing = await db.requiredDoc.count({ where: { projectTypeId: type.id, stage } });
      if (existing > 0 || codes.length === 0) continue;
      await db.requiredDoc.createMany({
        data: codes.map((code) => ({ projectTypeId: type.id, docTypeId: mustGet(docIds, code), stage })),
      });
      seeded++;
    }
  }
  log('project_types', PROJECT_TYPES.length, `${seeded} required-doc list(s) seeded`);
}

async function seedReturnReasons(db: PrismaClient) {
  for (const [sort, r] of RETURN_REASONS.entries()) {
    await db.returnReason.upsert({ where: { id: r.id }, create: { ...r, sort }, update: {} });
  }
  log('return_reasons', RETURN_REASONS.length);
}

async function seedHolidays(db: PrismaClient) {
  for (const h of HOLIDAYS_2026) {
    const date = new Date(`${h.date}T00:00:00Z`);
    await db.holiday.upsert({ where: { date }, create: { date, name: h.name }, update: {} });
  }
  log('holidays', HOLIDAYS_2026.length);
}

/** الصلاحية بتتزرع بس لو مفيش ولا دور ليه الصلاحية دي (صلاحية جديدة) — عشان شاشة الصلاحيات هي المرجع */
async function seedPermissions(db: PrismaClient) {
  let seeded = 0;
  for (const [permission, roles] of Object.entries(PERMISSIONS)) {
    const existing = await db.rolePermission.count({ where: { permission } });
    if (existing > 0) continue;
    await db.rolePermission.createMany({ data: roles.map((role) => ({ role, permission })) });
    seeded++;
  }
  log('role_permissions', Object.keys(PERMISSIONS).length, `${seeded} new permission key(s)`);
}

async function seedSettings(db: PrismaClient) {
  for (const [key, value] of Object.entries(SETTINGS)) {
    await db.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
  log('settings', Object.keys(SETTINGS).length);
}

function mustGet(map: Map<string, string>, key: string): string {
  const v = map.get(key);
  if (!v) throw new Error(`seed: unknown doc type code "${key}"`);
  return v;
}

function log(table: string, n: number, extra?: string) {
  console.log(`  ✓ ${table.padEnd(18)} ${String(n).padStart(3)}${extra ? `  (${extra})` : ''}`);
}
