/**
 * simulate-cli — محاكاة كاملة لمسار المستخلصات على بيانات اختبار معزولة (كل الأكواد TEST- وكل البريد ‎@invoices.test).
 *
 * بتعمل: رئاسة/قطاع/إدارة عامة/إدارة مختصة/سنترال/مشروع اختبار ← مقاول وعقد وأوامر تكليف لكل فئة (C1–C5)
 * ← مستخدم اختبار لكل دور بنطاقه ← مستخلصات بتتحرك بنفس خدمات الشاشات (تقديم، تحديد الفئة، اعتماد، إعادة، إيقاف، سداد)
 * لحد ما يبقى فيه مستخلص واقف عند كل مرحلة من كل فئة.
 * البريد لعناوين ‎.test مش بيتبعت (بيتسجل في سجل البريد بس).
 *
 * على السيرفر (من /srv/invoices/app):
 *   infra/run.sh npx tsx --conditions=react-server --tsconfig apps/web/tsconfig.json apps/web/scripts/simulate-cli.ts --run
 *   infra/run.sh npx tsx ... apps/web/scripts/simulate-cli.ts --cleanup      ← يمسح كل بيانات الاختبار
 */
import { randomBytes } from "node:crypto";
import { prisma, type Role, type ScopeType } from "@it/db";
import type { SessionUser } from "@/features/auth/auth.types";
import { hashPassword } from "@/features/auth/password";
import { saveDraft, submitDraft } from "@/features/invoices/draft.service";
import { act } from "@/features/invoices/flow.service";

const P = "TEST-";
const MAIL = "@invoices.test";
const CONTRACT_NO = "TEST/2026/1/1";

// ── التنظيف ────────────────────────────────────────────

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: MAIL } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const contract = await prisma.contract.findUnique({ where: { contractNo: CONTRACT_NO }, select: { id: true } });
  if (contract) {
    await prisma.invoice.deleteMany({ where: { contractId: contract.id } });
    await prisma.assignmentOrder.deleteMany({ where: { contractId: contract.id } });
    await prisma.contract.delete({ where: { id: contract.id } });
  }
  await prisma.emailOutbox.deleteMany({ where: { toEmail: { endsWith: MAIL } } });
  if (userIds.length) {
    // سجل التدقيق بيفضل (بدون اسم المستخدم المحذوف)
    await prisma.auditLog.updateMany({ where: { userId: { in: userIds } }, data: { userId: null } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.company.deleteMany({ where: { code: `${P}CO` } });
  await prisma.project.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.projectType.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.central.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.dept.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.generalDept.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.techUnit.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.sector.deleteMany({ where: { code: { startsWith: P } } });
  await prisma.presidency.deleteMany({ where: { code: { startsWith: P } } });
  console.log(`تم حذف بيانات الاختبار (${userIds.length} مستخدم)`);
}

// ── البيانات الأساسية ───────────────────────────────────

async function setup() {
  const pres = await prisma.presidency.create({ data: { code: `${P}PRES`, name: "رئاسة قطاعات (اختبار)" } });
  const sector = await prisma.sector.create({ data: { code: `${P}SEC`, name: "قطاع (اختبار)", presidencyId: pres.id } });
  await prisma.techUnit.create({ data: { code: `${P}TU`, name: "الشئون الفنية (اختبار)", sectorId: sector.id } });
  const gd = await prisma.generalDept.create({ data: { code: `${P}GD`, name: "إدارة عامة (اختبار)", sectorId: sector.id } });
  const dept = await prisma.dept.create({ data: { code: `${P}DEPT`, name: "إدارة مختصة (اختبار)", generalDeptId: gd.id } });
  const central = await prisma.central.create({ data: { code: `${P}CEN`, name: "سنترال (اختبار)", deptId: dept.id } });
  const type = await prisma.projectType.create({ data: { code: `${P}PT`, name: "نوع مشروع (اختبار)" } });
  const project = await prisma.project.create({ data: { code: `${P}PRJ`, name: "مشروع اختبار المسار", typeId: type.id, centralId: central.id } });
  const company = await prisma.company.create({ data: { code: `${P}CO`, name: "شركة اختبار", fullName: "شركة اختبار المسار (بيانات تجريبية)", email: `company${MAIL}` } });

  const contract = await prisma.contract.create({
    data: {
      contractNo: CONTRACT_NO, companyId: company.id, title: "عقد اختبار مسار المستخلصات (بيانات تجريبية)", contractValue: 2_000_000,
      payMonthlyPct: 70, payAsbuiltPct: 20, payHandoverPct: 10, finalGuaranteePct: 5,
      items: {
        create: [
          { itemNo: "1", description: "أعمال مدنية", isGroup: true, sortOrder: 1 },
          { itemNo: "1-1", parentNo: "1", description: "حفر وردم خندق كابلات", unit: "م.ط", contractQty: 5000, unitPrice: 100, workType: "مدني", sortOrder: 2 },
          { itemNo: "1-2", parentNo: "1", description: "توريد وتركيب كابل ألياف 48 شعيرة", unit: "م.ط", contractQty: 5000, unitPrice: 50, workType: "كهربي", sortOrder: 3 },
          { itemNo: "1-3", parentNo: "1", description: "تركيب كابينة MSAN", unit: "عدد", contractQty: 50, unitPrice: 20000, workType: "مدني", sortOrder: 4 },
          { itemNo: "1-4", parentNo: "1", description: "بند مستجد غير مُسعّر (اختبار C5)", unit: "عدد", contractQty: 10, unitPrice: null, workType: "مدني", sortOrder: 5 },
        ],
      },
    },
    include: { items: true },
  });
  const item = (no: string) => contract.items.find((i) => i.itemNo === no)!.id;

  const mkAo = (aoNo: string, name: string, value: number, planned: [string, number][]) =>
    prisma.assignmentOrder.create({
      data: {
        contractId: contract.id, aoNo, name, value, financialCommitment: value, projectId: project.id, status: "active",
        items: { create: planned.map(([no, qty]) => ({ contractItemId: item(no), plannedQty: qty })) },
      },
    });
  const aos = {
    C1: await mkAo("PO-C1", "اختبار C1 — بدون تجاوز", 550_000, [["1-1", 1000], ["1-2", 1000], ["1-3", 20]]),
    C2: await mkAo("PO-C2", "اختبار C2 — تجاوز بند دون تجاوز الإجمالي", 60_000, [["1-1", 100], ["1-2", 1000]]),
    C3: await mkAo("PO-C3", "اختبار C3 — تجاوز الإجمالي حتى 25%", 10_000, [["1-1", 100]]),
    C4: await mkAo("PO-C4", "اختبار C4 — تجاوز الإجمالي أكثر من 25%", 10_000, [["1-1", 100]]),
    C5: await mkAo("PO-C5", "اختبار C5 — بند غير مُسعّر", 10_000, [["1-1", 100], ["1-4", 5]]),
  };

  // مستخدم لكل دور بنطاقه
  const password = randomBytes(9).toString("base64url");
  const passwordHash = await hashPassword(password);
  const defs: [string, string, Role, ScopeType, string | null][] = [
    ["company", "مسؤول مستخلصات شركة الاختبار", "company", "company", company.id],
    ["sup", "مشرف التنفيذ (اختبار)", "supervisor", "dept", dept.id],
    ["exec", "مدير التنفيذ (اختبار)", "exec_mgr", "dept", dept.id],
    ["gm", "المدير العام (اختبار)", "gm", "general_dept", gd.id],
    ["tech", "الشئون الفنية (اختبار)", "tech_affairs", "sector", sector.id],
    ["planning", "التخطيط (اختبار)", "planning", "sector", sector.id],
    ["pres", "رئيس رئاسة القطاعات (اختبار)", "presidency_head", "presidency", pres.id],
    ["committee", "اللجنة العليا (اختبار)", "committee", "sector", sector.id],
    ["sector", "رئيس القطاع (اختبار)", "sector_head", "sector", sector.id],
    ["stores", "المخازن والمشتريات (اختبار)", "stores", "sector", sector.id],
    ["finance", "الإدارة المالية (اختبار)", "finance", "sector", sector.id],
  ];
  const users: Record<string, SessionUser> = {};
  for (const [key, name, role, scopeType, scopeId] of defs) {
    const email = `test.${key}${MAIL}`;
    const u = await prisma.user.create({ data: { email, name, passwordHash, active: true, roles: { create: { role, scopeType, scopeId } } } });
    users[key] = { id: u.id, name, email, roles: [{ role, scopeType, scopeId }] };
  }
  const workTypes = await prisma.workType.findMany({ where: { active: true }, select: { id: true, code: true } });
  const wt = (code: string) => (workTypes.find((w) => w.code === code) ?? workTypes[0]!).id;
  const reasons = await prisma.returnReason.findMany({ where: { active: true }, select: { id: true }, take: 1 });
  return { aos, users, password, wt, reasonId: reasons[0]?.id };
}

// ── المحاكاة ────────────────────────────────────────────

type Ctx = Awaited<ReturnType<typeof setup>>;
type Line = { code: string; qty: number };

const ROLE_OF: Record<string, string> = {
  sup: "sup", exec: "exec", gm: "gm", tech: "tech", plan: "planning", pres: "pres", committee: "committee",
  pricing: "planning", sector: "sector", stores: "stores", finance: "finance",
};

let seq = 0;

async function create(c: Ctx, cat: keyof Ctx["aos"], path: string, lines: Line[], work = "CIVIL"): Promise<string> {
  seq++;
  const { draftId } = await saveDraft(c.users.company!, {
    draftId: null, aoId: c.aos[cat].id, invoiceNo: `T-${String(seq).padStart(3, "0")}`, pathName: path, period: "أكتوبر 2026",
    workTypeId: c.wt(work), siteCode: "", lines: lines.map((l) => ({ ...l, site: "" })), materials: [],
  });
  return draftId;
}

async function current(id: string) {
  return prisma.invoice.findUniqueOrThrow({ where: { id }, select: { status: true, currentStep: true, suggestedCategory: true, invoiceNo: true } });
}

/** يقدّم المستخلص ويعتمده مرحلة بمرحلة لحد المرحلة المطلوبة ("paid" = لحد السداد) */
async function advance(c: Ctx, id: string, until: string) {
  await submitDraft(c.users.company!, id);
  for (let guard = 0; guard < 20; guard++) {
    const inv = await current(id);
    if (inv.status === "paid" || inv.currentStep === until) return;
    const step = inv.currentStep!;
    const user = c.users[ROLE_OF[step]!]!;
    if (step === "exec") await act(user, id, { type: "setCategory", category: inv.suggestedCategory ?? "C1" });
    if (step === "finance") {
      await act(user, id, { type: "pay", ref: `CHQ-${inv.invoiceNo}`, method: "شيك" });
      return;
    }
    await act(user, id, { type: "approve", note: "اعتماد (محاكاة)" });
  }
  throw new Error(`تعذر الوصول إلى ${until}`);
}

/** يرجّع "since" لورا N يوم عشان يبان التأخير على المدة المستهدفة */
async function age(id: string, days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  await prisma.invoice.update({ where: { id }, data: { since } });
}

async function run() {
  if (await prisma.contract.findUnique({ where: { contractNo: CONTRACT_NO } })) throw new Error("بيانات الاختبار موجودة بالفعل — شغّل --cleanup الأول");
  const c = await setup();
  const C1: Line[] = [{ code: "1-1", qty: 30 }, { code: "1-2", qty: 30 }, { code: "1-3", qty: 1 }];
  const out: string[] = [];
  const log = async (id: string, label: string) => {
    const i = await current(id);
    out.push(`${i.invoiceNo}\t${label}\t${i.status}\t${i.currentStep ?? "—"}`);
  };

  // C1: واحد عند كل مرحلة + مسددين + مسودة + معاد للمقاول + معاد لمرحلة + موقوف
  for (const [stop, days] of [["sup", 1], ["exec", 4], ["gm", 2], ["tech", 6], ["stores", 1], ["finance", 5]] as const) {
    const id = await create(c, "C1", `C1 — عند ${stop}`, C1);
    await advance(c, id, stop);
    await age(id, days);
    await log(id, `C1 عند ${stop}`);
  }
  for (const n of [1, 2]) {
    const id = await create(c, "C1", `C1 — مسدد ${n}`, C1, n === 2 ? "ELECTRICAL" : "CIVIL");
    await advance(c, id, "paid");
    await log(id, "C1 مسدد");
  }
  {
    const id = await create(c, "C1", "C1 — مسودة لدى المقاول", C1);
    await log(id, "C1 مسودة");
  }
  if (c.reasonId) {
    const id = await create(c, "C1", "C1 — معاد للمقاول من المدير العام", C1);
    await advance(c, id, "gm");
    await act(c.users.gm!, id, { type: "return", target: "company", reasonIds: [c.reasonId], note: "يرجى استكمال المستندات (محاكاة)" });
    await log(id, "C1 معاد للمقاول");
    const id2 = await create(c, "C1", "C1 — معاد من الشئون الفنية لمدير التنفيذ", C1);
    await advance(c, id2, "tech");
    await act(c.users.tech!, id2, { type: "return", target: "exec", reasonIds: [c.reasonId], note: "مراجعة الكميات (محاكاة)" });
    await log(id2, "C1 معاد لمرحلة");
  }
  {
    const id = await create(c, "C1", "C1 — موقوف بانتظار ملحق أمر التكليف", C1);
    await advance(c, id, "exec");
    await act(c.users.tech!, id, { type: "hold", reason: "بانتظار اعتماد ملحق أمر التكليف (محاكاة)" });
    await log(id, "C1 موقوف");
  }

  // C2: تجاوز بند — عند التخطيط وعند المخازن
  for (const stop of ["plan", "stores"]) {
    const id = await create(c, "C2", `C2 — عند ${stop}`, [{ code: "1-1", qty: 150 }, { code: "1-2", qty: 100 }]);
    await advance(c, id, stop);
    await log(id, `C2 عند ${stop}`);
  }
  // C3: تجاوز الإجمالي 10% — عند رئيس القطاع
  {
    const id = await create(c, "C3", "C3 — عند رئيس القطاع", [{ code: "1-1", qty: 110 }]);
    await advance(c, id, "sector");
    await age(id, 3);
    await log(id, "C3 عند رئيس القطاع");
  }
  // C4: تجاوز 50% — عند رئاسة القطاعات وعند اللجنة العليا
  for (const stop of ["pres", "committee"]) {
    const id = await create(c, "C4", `C4 — عند ${stop}`, [{ code: "1-1", qty: 150 }]);
    await advance(c, id, stop);
    await log(id, `C4 عند ${stop}`);
  }
  // C5: بند غير مُسعّر — عند التسعير
  {
    const id = await create(c, "C5", "C5 — عند تسعير البند المستجد", [{ code: "1-1", qty: 10 }, { code: "1-4", qty: 2 }]);
    await advance(c, id, "pricing");
    await log(id, "C5 عند التسعير");
  }

  console.log("المستخلص\tالسيناريو\tالحالة\tالمرحلة");
  out.forEach((l) => console.log(l));
  const mails = await prisma.emailOutbox.count({ where: { toEmail: { endsWith: MAIL } } });
  console.log(`رسائل البريد المسجلة لحسابات الاختبار: ${mails} (لا تُرسل — عناوين ‎.test)`);
  console.log(`ACCOUNTS: ${Object.values(c.users).map((u) => u.email).join(" ")}`);
  console.log(`PASSWORD=${c.password}`);
}

const arg = process.argv[2];
(arg === "--cleanup" ? cleanup() : arg === "--run" ? run() : Promise.reject(new Error("الاستخدام: simulate-cli --run | --cleanup")))
  .catch((e: unknown) => {
    console.error("فشل:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
