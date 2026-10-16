import "server-only";
import { cache } from "react";
import type { SessionUser } from "@/features/auth/auth.types";
import { can } from "@/features/auth/permissions";
import { visibleInvoicesWhere } from "@/features/auth/scope";
import { AppError } from "@/lib/errors";
import { KIND_LABELS, dependentsMessage, type OrgKind } from "./org.kinds";
import {
  invoiceCountsByCompany,
  invoiceCountsByProject,
  invoiceCountsByWorkType,
  listCompanies,
  listOrgLevels,
  listProjectTypes,
  listProjects,
  listWorkTypes,
} from "./org.repo";
import type { OrgData } from "./org.schema";
import { buildIndex, nodeKey, pathOf, rollupCounts, type FlatNode, type NodeCounts } from "./org.tree";
import { countDependents, createEntity, deleteEntity, findEntity, updateEntity } from "./org-write.repo";

export type OrgNodeRow = FlatNode & NodeCounts;

export type ProjectRow = {
  id: string;
  code: string;
  name: string;
  typeId: string;
  typeName: string;
  centralId: string;
  centralName: string;
  /** الإدارة المختصة ← العامة ← القطاع ← الرئاسة */
  path: string[];
  startDate: string | null;
  notes: string | null;
  aoCount: number;
  invoices: number;
};

export type ProjectTypeRow = { id: string; code: string; name: string; projects: number; requiredDocs: number };

export type WorkTypeRow = { id: string; code: string; name: string; isPlanning: boolean; sort: number; active: boolean; invoices: number };

export type CompanyRow = {
  id: string;
  code: string;
  name: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  commercialReg: string | null;
  taxNo: string | null;
  address: string | null;
  contracts: number;
  invoices: number;
};

export type OrgPageData = {
  nodes: OrgNodeRow[];
  projects: ProjectRow[];
  types: ProjectTypeRow[];
  workTypes: WorkTypeRow[];
  companies: CompanyRow[];
};

/** كل بيانات شاشة /org مرة واحدة لكل request. عدّادات المستخلصات جوه نطاق المستخدم بس */
export const getOrgPageData = cache(async (user: SessionUser): Promise<OrgPageData> => {
  const scope = visibleInvoicesWhere(user);
  const [[pres, sectors, techUnits, gdepts, depts, centrals], projects, types, workTypes, companies, invByProject, invByCompany, invByWorkType] =
    await Promise.all([
      listOrgLevels(),
      listProjects(),
      listProjectTypes(),
      listWorkTypes(),
      listCompanies(),
      invoiceCountsByProject(scope),
      invoiceCountsByCompany(scope),
      invoiceCountsByWorkType(scope),
    ]);

  const flat: FlatNode[] = [
    ...pres.map((n) => ({ kind: "presidency" as const, id: n.id, code: n.code, name: n.name, parentId: null })),
    ...sectors.map((n) => ({ kind: "sector" as const, id: n.id, code: n.code, name: n.name, parentId: n.presidencyId })),
    ...techUnits.map((n) => ({ kind: "techUnit" as const, id: n.id, code: n.code, name: n.name, parentId: n.sectorId })),
    ...gdepts.map((n) => ({ kind: "generalDept" as const, id: n.id, code: n.code, name: n.name, parentId: n.sectorId })),
    ...depts.map((n) => ({ kind: "dept" as const, id: n.id, code: n.code, name: n.name, parentId: n.generalDeptId })),
    ...centrals.map((n) => ({ kind: "central" as const, id: n.id, code: n.code, name: n.name, parentId: n.deptId })),
  ];

  const perCentral = new Map<string, NodeCounts>();
  for (const p of projects) {
    const c = perCentral.get(p.centralId) ?? { projects: 0, invoices: 0 };
    c.projects += 1;
    c.invoices += invByProject.get(p.id) ?? 0;
    perCentral.set(p.centralId, c);
  }
  const counts = rollupCounts(flat, perCentral);
  const index = buildIndex(flat);
  const typeName = new Map(types.map((t) => [t.id, t.name]));

  return {
    nodes: flat.map((n) => ({ ...n, ...(counts.get(nodeKey(n.kind, n.id)) ?? { projects: 0, invoices: 0 }) })),
    projects: projects.map((p) => {
      const path = pathOf(index, "central", p.centralId);
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        typeId: p.typeId,
        typeName: typeName.get(p.typeId) ?? "—",
        centralId: p.centralId,
        centralName: path.at(-1)?.name ?? "—",
        path: path.slice(0, -1).reverse().map((x) => x.name),
        startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
        notes: p.notes,
        aoCount: p._count.assignmentOrders,
        invoices: invByProject.get(p.id) ?? 0,
      };
    }),
    types: types.map((t) => ({ id: t.id, code: t.code, name: t.name, projects: t._count.projects, requiredDocs: t._count.requiredDocs })),
    workTypes: workTypes.map((w) => ({ ...w, invoices: invByWorkType.get(w.id) ?? 0 })),
    companies: companies.map(({ _count, ...c }) => ({ ...c, contracts: _count.contracts, invoices: invByCompany.get(c.id) ?? 0 })),
  };
});

/** الإضافة والتعديل والمسح والرفع: نفس صلاحية رفع البيانات الأساسية */
export function canEditOrg(user: SessionUser): Promise<boolean> {
  return can(user, "master.import");
}

async function assertCanEdit(user: SessionUser) {
  if (!(await canEditOrg(user))) throw new AppError("FORBIDDEN");
}

function prismaCode(e: unknown): string | undefined {
  return typeof e === "object" && e !== null && "code" in e && typeof e.code === "string" ? e.code : undefined;
}

function mapWriteError(e: unknown, kind: OrgKind, code?: string | null): never {
  const pc = prismaCode(e);
  if (pc === "P2002") throw new AppError("CONFLICT", `الكود ${code ?? ""} مستخدم قبل كده في ${KIND_LABELS[kind].many}`, { cause: e });
  if (pc === "P2003") throw new AppError("VALIDATION", "الجهة اللي اخترتها مش موجودة (يمكن اتمسحت) — حدّث الصفحة وجرّب تاني", { cause: e });
  if (pc === "P2025") throw new AppError("NOT_FOUND", `${KIND_LABELS[kind].one} مش موجود — يمكن اتمسح`, { cause: e });
  throw e;
}

export async function createOrgEntity(user: SessionUser, data: OrgData, code: string) {
  await assertCanEdit(user);
  try {
    return await createEntity(data, code, user.id);
  } catch (e) {
    mapWriteError(e, data.kind, code);
  }
}

export async function updateOrgEntity(user: SessionUser, id: string, data: OrgData) {
  await assertCanEdit(user);
  try {
    return await updateEntity(id, data, user.id);
  } catch (e) {
    mapWriteError(e, data.kind);
  }
}

/** المسح ممنوع لو تحت الكيان أي بيانات (أبناء، مشروعات، أوامر تكليف، عقود، مستخدمين على النطاق) */
export async function deleteOrgEntity(user: SessionUser, kind: OrgKind, id: string) {
  await assertCanEdit(user);
  const rec = await findEntity(kind, id);
  if (!rec) throw new AppError("NOT_FOUND", `${KIND_LABELS[kind].one} مش موجود — يمكن اتمسح`);
  const blocked = dependentsMessage(kind, rec.name, await countDependents(kind, id));
  if (blocked) throw new AppError("CONFLICT", blocked);
  try {
    await deleteEntity(kind, id, rec, user.id);
  } catch (e) {
    if (prismaCode(e) === "P2003") throw new AppError("CONFLICT", "اتضاف تحته بيانات دلوقتي — حدّث الصفحة", { cause: e });
    mapWriteError(e, kind);
  }
  return rec;
}
