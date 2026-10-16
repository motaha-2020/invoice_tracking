// بيانات تطوير وهمية — بتشتغل بس مع SEED_DEMO=1، وكل المستخدمين بكلمة سر SEED_DEMO_PASSWORD.
// idempotent: كل حاجة upsert بالكود، والبنود/المواقع بتتعمل بس لو أمر التكليف لسه فاضي.
import type { PrismaClient, ScopeType } from '../../src/index';
import { hashPassword } from './crypto';
import {
  AOS, COMPANIES, CONTRACTS, ITEM_CATALOG, ITEM_MATERIAL, MATERIALS, ORG, PROJECTS, USERS,
} from './demo-data';

const MIN_PASSWORD = 12;
type Ids = Map<string, string>;

/** بيتنادى قبل أي كتابة في DB عشان الإعداد الغلط يقف من الأول */
export function assertDemoEnv(): string {
  const password = process.env.SEED_DEMO_PASSWORD ?? '';
  if (password.length < MIN_PASSWORD) {
    throw new Error(`يتطلب SEED_DEMO=1 تحديد SEED_DEMO_PASSWORD (${MIN_PASSWORD} حرفاً على الأقل)`);
  }
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_FORCE !== '1') {
    throw new Error('تم رفض إنشاء بيانات تجريبية مع NODE_ENV=production (استخدم SEED_DEMO_FORCE=1 للتأكيد)');
  }
  return password;
}

export async function seedDemo(db: PrismaClient): Promise<void> {
  const password = assertDemoEnv();
  const org = await seedOrg(db);
  const companies = await seedCompanies(db);
  await seedContractsAndAos(db, companies);
  await seedUsers(db, password, { ...org, company: companies });
}

async function seedOrg(db: PrismaClient) {
  const presidency: Ids = new Map();
  for (const p of ORG.presidencies) {
    const r = await db.presidency.upsert({ where: { code: p.code }, create: p, update: { name: p.name } });
    presidency.set(p.code, r.id);
  }
  const sector: Ids = new Map();
  for (const s of ORG.sectors) {
    const data = { name: s.name, presidencyId: get(presidency, s.parent) };
    const r = await db.sector.upsert({ where: { code: s.code }, create: { code: s.code, ...data }, update: data });
    sector.set(s.code, r.id);
  }
  for (const t of ORG.techUnits) {
    const data = { name: t.name, sectorId: get(sector, t.parent) };
    await db.techUnit.upsert({ where: { code: t.code }, create: { code: t.code, ...data }, update: data });
  }
  const general_dept: Ids = new Map();
  for (const g of ORG.generalDepts) {
    const data = { name: g.name, sectorId: get(sector, g.parent) };
    const r = await db.generalDept.upsert({ where: { code: g.code }, create: { code: g.code, ...data }, update: data });
    general_dept.set(g.code, r.id);
  }
  const dept: Ids = new Map();
  for (const d of ORG.depts) {
    const data = { name: d.name, generalDeptId: get(general_dept, d.parent) };
    const r = await db.dept.upsert({ where: { code: d.code }, create: { code: d.code, ...data }, update: data });
    dept.set(d.code, r.id);
  }
  const central: Ids = new Map();
  for (const c of ORG.centrals) {
    const data = { name: c.name, deptId: get(dept, c.parent) };
    const r = await db.central.upsert({ where: { code: c.code }, create: { code: c.code, ...data }, update: data });
    central.set(c.code, r.id);
  }

  const types: Ids = new Map((await db.projectType.findMany()).map((t) => [t.code, t.id]));
  for (const p of PROJECTS) {
    const data = { name: p.name, typeId: get(types, p.type), centralId: get(central, p.central) };
    await db.project.upsert({ where: { code: p.code }, create: { code: p.code, ...data }, update: data });
  }
  console.log(`  ✓ demo org          ${ORG.centrals.length} centrals, ${PROJECTS.length} projects`);
  return { presidency, sector, general_dept, dept, central };
}

async function seedCompanies(db: PrismaClient): Promise<Ids> {
  const ids: Ids = new Map();
  for (const c of COMPANIES) {
    const r = await db.company.upsert({ where: { code: c.code }, create: c, update: c });
    ids.set(c.code, r.id);
  }
  return ids;
}

async function seedContractsAndAos(db: PrismaClient, companies: Ids) {
  const projects: Ids = new Map((await db.project.findMany({ select: { id: true, code: true } })).map((p) => [p.code, p.id]));
  const materials: Ids = new Map();
  for (const m of MATERIALS) {
    const r = await db.material.upsert({ where: { code: m.code }, create: m, update: {} });
    materials.set(m.code, r.id);
  }

  const contractIds: Ids = new Map();
  const prices = new Map<string, Map<string, { id: string; price: number }>>();
  for (const k of CONTRACTS) {
    const [payMonthlyPct, payAsbuiltPct, payHandoverPct] = k.pay;
    const data = {
      companyId: get(companies, k.company), title: k.title, startDate: day(k.start),
      vatPct: 14, taxPct: 1, payMonthlyPct, payAsbuiltPct, payHandoverPct, finalGuaranteePct: 5,
      delayFinePctWeek: k.fine?.[0] ?? null, delayFineCapPct: k.fine?.[1] ?? null, warrantyMonths: 12,
    };
    const contract = await db.contract.upsert({ where: { contractNo: k.no }, create: { contractNo: k.no, ...data }, update: data });
    contractIds.set(k.no, contract.id);

    const itemMap = new Map<string, { id: string; price: number }>();
    for (const [sortOrder, c] of ITEM_CATALOG.entries()) {
      const unitPrice = c.group || c.price == null ? null : Math.round(c.price * k.priceFactor);
      const parentNo = c.itemNo.split('-').slice(0, -1).join('-') || null;
      const row = {
        parentNo, isGroup: !!c.group, description: c.description, unit: c.unit ?? null,
        unitPrice, workType: c.workType ?? null, sortOrder,
      };
      const item = await db.contractItem.upsert({
        where: { contractId_itemNo: { contractId: contract.id, itemNo: c.itemNo } },
        create: { contractId: contract.id, itemNo: c.itemNo, ...row },
        update: row,
      });
      if (unitPrice != null) itemMap.set(c.itemNo, { id: item.id, price: unitPrice });
    }
    prices.set(k.no, itemMap);
  }
  console.log(`  ✓ demo contracts    ${CONTRACTS.length} (× ${ITEM_CATALOG.length} items)`);

  let filled = 0;
  for (const [i, ao] of AOS.entries()) {
    const contractId = get(contractIds, ao.contract);
    const row = await db.assignmentOrder.upsert({
      where: { contractId_aoNo: { contractId, aoNo: ao.no } },
      create: { contractId, aoNo: ao.no, aoDate: day(ao.date), name: `أمر تكليف ${ao.no}`, projectId: get(projects, ao.project), status: 'active' },
      update: {},
    });
    if ((await db.aoItem.count({ where: { aoId: row.id } })) > 0) continue;

    // مش كل البنود في كل أمر تكليف — اختيار ثابت (deterministic) عشان التشغيل يتكرر بنفس النتيجة
    const items = ITEM_CATALOG.filter((c, j) => c.qty && ((i + j) % 5 !== 0 || ['1-9-1', '2-6-1'].includes(c.itemNo)));
    const itemMap = prices.get(ao.contract) ?? new Map();
    const lines = items.flatMap((c) => {
      const ci = itemMap.get(c.itemNo);
      return ci ? [{ itemNo: c.itemNo, contractItemId: ci.id, price: ci.price, qty: Math.max(1, Math.round((c.qty ?? 0) * ao.scale)) }] : [];
    });
    const planned = new Map<string, number>();
    for (const l of lines) {
      const m = ITEM_MATERIAL[l.itemNo];
      if (m) planned.set(m[0], (planned.get(m[0]) ?? 0) + l.qty * m[1]);
    }
    const value = lines.reduce((s, l) => s + l.qty * l.price, 0);
    const base = 60 + i * 7;

    await db.$transaction([
      db.assignmentOrder.update({ where: { id: row.id }, data: { value, financialCommitment: value } }),
      db.aoSite.createMany({
        data: Array.from({ length: ao.sites }, (_, s) => ({ aoId: row.id, code: `#${base + s}`, name: `كابينة ${base + s}` })),
        skipDuplicates: true,
      }),
      db.aoItem.createMany({ data: lines.map((l) => ({ aoId: row.id, contractItemId: l.contractItemId, plannedQty: l.qty })) }),
      db.aoMaterial.createMany({
        data: [...planned].map(([code, q]) => ({ aoId: row.id, materialId: get(materials, code), plannedQty: Math.round(q * 10000) / 10000 })),
        skipDuplicates: true,
      }),
    ]);
    filled++;
  }
  console.log(`  ✓ demo AOs          ${AOS.length} (${filled} filled with items/sites/materials)`);
}

async function seedUsers(db: PrismaClient, password: string, scopes: Record<string, Ids>) {
  const passwordHash = await hashPassword(password);
  for (const u of USERS) {
    const user = await db.user.upsert({
      where: { email: u.email },
      create: { email: u.email, name: u.name, passwordHash, active: true },
      update: { name: u.name, passwordHash, active: true },
    });
    const scopeType = u.scope.type as ScopeType;
    const scopeId = u.scope.type === 'all' ? null : get(scopes[u.scope.type] ?? new Map(), u.scope.code);
    const exists = await db.userRole.findFirst({ where: { userId: user.id, role: u.role, scopeType, scopeId } });
    if (!exists) await db.userRole.create({ data: { userId: user.id, role: u.role, scopeType, scopeId } });
  }
  console.log(`  ✓ demo users        ${USERS.length} (password from SEED_DEMO_PASSWORD)`);
}

function get(map: Ids, code: string): string {
  const id = map.get(code);
  if (!id) throw new Error(`seed demo: missing reference "${code}"`);
  return id;
}

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}
