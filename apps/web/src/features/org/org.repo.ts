import "server-only";
import { prisma, type Prisma } from "@it/db";

/**
 * قراءة الهيكل والمشروعات والشركات لشاشة /org. الجداول دي صغيرة (مئات الصفوف) فبنقراها كاملة.
 * عدّادات المستخلصات بتاخد `where` جاهز من scope.ts — الـ repo ما يبنيش نطاق بنفسه.
 */

const node = { id: true, code: true, name: true } as const;

export function listOrgLevels() {
  return Promise.all([
    prisma.presidency.findMany({ select: node, orderBy: { code: "asc" } }),
    prisma.sector.findMany({ select: { ...node, presidencyId: true }, orderBy: { code: "asc" } }),
    prisma.techUnit.findMany({ select: { ...node, sectorId: true }, orderBy: { code: "asc" } }),
    prisma.generalDept.findMany({ select: { ...node, sectorId: true }, orderBy: { code: "asc" } }),
    prisma.dept.findMany({ select: { ...node, generalDeptId: true }, orderBy: { code: "asc" } }),
    prisma.central.findMany({ select: { ...node, deptId: true }, orderBy: { code: "asc" } }),
  ]);
}

export function listProjects() {
  return prisma.project.findMany({
    select: {
      ...node,
      typeId: true,
      centralId: true,
      startDate: true,
      notes: true,
      _count: { select: { assignmentOrders: true } },
    },
    orderBy: { code: "asc" },
  });
}

export function listProjectTypes() {
  return prisma.projectType.findMany({
    select: { ...node, _count: { select: { projects: true, requiredDocs: true } } },
    orderBy: { code: "asc" },
  });
}

export function listWorkTypes() {
  return prisma.workType.findMany({
    select: { ...node, isPlanning: true, sort: true, active: true },
    orderBy: [{ sort: "asc" }, { code: "asc" }],
  });
}

/** عدد المستخلصات لكل نوع أعمال (جوه النطاق اللي اتبعت) */
export async function invoiceCountsByWorkType(where: Prisma.InvoiceWhereInput): Promise<Map<string, number>> {
  const rows = await prisma.invoice.groupBy({ by: ["workTypeId"], where: { AND: [where, { workTypeId: { not: null } }] }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.workTypeId!, r._count._all]));
}

export function listCompanies() {
  return prisma.company.findMany({
    select: {
      ...node,
      fullName: true,
      commercialReg: true,
      taxNo: true,
      email: true,
      phone: true,
      address: true,
      _count: { select: { contracts: true } },
    },
    orderBy: { code: "asc" },
  });
}

/** عدد المستخلصات لكل مشروع (جوه النطاق اللي اتبعت) */
export async function invoiceCountsByProject(where: Prisma.InvoiceWhereInput): Promise<Map<string, number>> {
  const rows = await prisma.invoice.groupBy({ by: ["aoId"], where, _count: { _all: true } });
  if (!rows.length) return new Map();
  const aos = await prisma.assignmentOrder.findMany({
    where: { id: { in: rows.map((r) => r.aoId) }, projectId: { not: null } },
    select: { id: true, projectId: true },
  });
  const projectOf = new Map(aos.map((a) => [a.id, a.projectId!]));
  const out = new Map<string, number>();
  for (const r of rows) {
    const p = projectOf.get(r.aoId);
    if (p) out.set(p, (out.get(p) ?? 0) + r._count._all);
  }
  return out;
}

/** عدد المستخلصات لكل شركة (جوه النطاق اللي اتبعت) */
export async function invoiceCountsByCompany(where: Prisma.InvoiceWhereInput): Promise<Map<string, number>> {
  const rows = await prisma.invoice.groupBy({ by: ["contractId"], where, _count: { _all: true } });
  if (!rows.length) return new Map();
  const contracts = await prisma.contract.findMany({
    where: { id: { in: rows.map((r) => r.contractId) } },
    select: { id: true, companyId: true },
  });
  const companyOf = new Map(contracts.map((c) => [c.id, c.companyId]));
  const out = new Map<string, number>();
  for (const r of rows) {
    const c = companyOf.get(r.contractId);
    if (c) out.set(c, (out.get(c) ?? 0) + r._count._all);
  }
  return out;
}
