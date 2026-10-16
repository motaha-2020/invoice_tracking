import "server-only";
import { prisma, type Prisma } from "@it/db";
import { companyUpdateData, type CompanyImportRow, type ExistingCompany } from "./companies-import.rules";
import type { ExistingOrg, OrgImportRow, UserLookup } from "./org-import.rules";
import type { ExistingProjectsData, ProjectsImportRow } from "./projects-import.rules";

/**
 * قراءة الموجود (للمعاينة) والكتابة (جوه transaction الـ commit) لقوالب 01/02/03.
 * الربط بالأب بيتم بالكود (connect by code) — مش محتاجين خرائط ids.
 */
type Tx = Prisma.TransactionClient;

const toMap = <T extends { code: string }, V>(rows: T[], f: (r: T) => V) => new Map(rows.map((r) => [r.code, f(r)]));

export async function loadExistingOrg(): Promise<ExistingOrg> {
  const [presidency, sector, techUnit, generalDept, dept, central] = await Promise.all([
    prisma.presidency.findMany({ select: { code: true, name: true } }),
    prisma.sector.findMany({ select: { code: true, name: true, presidency: { select: { code: true } } } }),
    prisma.techUnit.findMany({ select: { code: true, name: true, sector: { select: { code: true } } } }),
    prisma.generalDept.findMany({ select: { code: true, name: true, sector: { select: { code: true } } } }),
    prisma.dept.findMany({ select: { code: true, name: true, generalDept: { select: { code: true } } } }),
    prisma.central.findMany({ select: { code: true, name: true, dept: { select: { code: true } } } }),
  ]);
  return {
    presidency: toMap(presidency, (r) => ({ name: r.name, parentCode: null })),
    sector: toMap(sector, (r) => ({ name: r.name, parentCode: r.presidency.code })),
    techUnit: toMap(techUnit, (r) => ({ name: r.name, parentCode: r.sector.code })),
    generalDept: toMap(generalDept, (r) => ({ name: r.name, parentCode: r.sector.code })),
    dept: toMap(dept, (r) => ({ name: r.name, parentCode: r.generalDept.code })),
    central: toMap(central, (r) => ({ name: r.name, parentCode: r.dept.code })),
  };
}

export async function loadUsersByEmail(emails: string[]): Promise<UserLookup> {
  if (!emails.length) return new Map();
  const users = await prisma.user.findMany({
    where: { email: { in: emails, mode: "insensitive" } },
    select: { id: true, name: true, email: true },
  });
  return new Map(users.map((u) => [u.email.toLowerCase(), { id: u.id, name: u.name }]));
}

export async function loadExistingProjects(): Promise<ExistingProjectsData> {
  const [types, centrals, projects] = await Promise.all([
    prisma.projectType.findMany({ select: { code: true, name: true } }),
    prisma.central.findMany({ select: { code: true, name: true } }),
    prisma.project.findMany({
      select: { code: true, name: true, startDate: true, notes: true, type: { select: { code: true } }, central: { select: { code: true } } },
    }),
  ]);
  return {
    types: toMap(types, (r) => ({ name: r.name })),
    centrals: toMap(centrals, (r) => ({ name: r.name })),
    projects: toMap(projects, (r) => ({
      name: r.name,
      typeCode: r.type.code,
      centralCode: r.central.code,
      startDate: r.startDate ? r.startDate.toISOString().slice(0, 10) : null,
      notes: r.notes,
    })),
  };
}

export async function loadExistingCompanies(): Promise<Map<string, ExistingCompany>> {
  const rows = await prisma.company.findMany({
    select: { code: true, name: true, fullName: true, email: true, commercialReg: true, taxNo: true, phone: true, address: true },
  });
  return toMap(rows, (r) => ({
    name: r.name,
    fullName: r.fullName,
    email: r.email,
    commercialReg: r.commercialReg,
    taxNo: r.taxNo,
    phone: r.phone,
    address: r.address,
  }));
}

// ─────────────── الكتابة (جوه transaction) ───────────────

export async function upsertOrgRow(tx: Tx, r: OrgImportRow): Promise<void> {
  const { code, name } = r;
  const p = r.parentCode ?? "";
  const where = { code };
  const update = { name };
  switch (r.level) {
    case "presidency":
      await tx.presidency.upsert({ where, create: { code, name }, update });
      return;
    case "sector":
      await tx.sector.upsert({ where, create: { code, name, presidency: { connect: { code: p } } }, update });
      return;
    case "techUnit":
      await tx.techUnit.upsert({ where, create: { code, name, sector: { connect: { code: p } } }, update });
      return;
    case "generalDept": {
      const g = await tx.generalDept.upsert({ where, create: { code, name, sector: { connect: { code: p } } }, update, select: { id: true } });
      if (r.gmUserId) await linkGm(tx, r.gmUserId, g.id);
      return;
    }
    case "dept":
      await tx.dept.upsert({ where, create: { code, name, generalDept: { connect: { code: p } } }, update });
      return;
    case "central":
      await tx.central.upsert({ where, create: { code, name, dept: { connect: { code: p } } }, update });
      return;
  }
}

/** المدير العام: دور gm على نطاق الإدارة العامة (لو مش موجود) */
async function linkGm(tx: Tx, userId: string, generalDeptId: string) {
  const exists = await tx.userRole.findFirst({ where: { userId, role: "gm", scopeType: "general_dept", scopeId: generalDeptId } });
  if (!exists) await tx.userRole.create({ data: { userId, role: "gm", scopeType: "general_dept", scopeId: generalDeptId } });
}

export async function upsertProjectsRow(tx: Tx, r: ProjectsImportRow): Promise<void> {
  if (r.kind === "type") {
    await tx.projectType.upsert({ where: { code: r.code }, create: { code: r.code, name: r.name }, update: { name: r.name } });
    return;
  }
  const startDate = r.startDate ? new Date(`${r.startDate}T00:00:00Z`) : null;
  await tx.project.upsert({
    where: { code: r.code },
    create: {
      code: r.code,
      name: r.name,
      startDate,
      notes: r.notes,
      type: { connect: { code: r.typeCode } },
      central: { connect: { code: r.centralCode } },
    },
    update: {
      name: r.name,
      type: { connect: { code: r.typeCode } },
      central: { connect: { code: r.centralCode } },
      // الخلايا الفاضية ما بتمسحش القديم
      ...(startDate ? { startDate } : {}),
      ...(r.notes !== null ? { notes: r.notes } : {}),
    },
  });
}

export async function upsertCompanyRow(tx: Tx, r: CompanyImportRow): Promise<void> {
  const { code, ...fields } = r;
  await tx.company.upsert({ where: { code }, create: { code, ...fields }, update: companyUpdateData(r) });
}
