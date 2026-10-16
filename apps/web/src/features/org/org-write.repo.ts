import "server-only";
import { prisma, type Prisma, type ScopeType } from "@it/db";
import type { OrgKind } from "./org.kinds";
import type { OrgData } from "./org.schema";

/**
 * الكتابة على الهيكل وأنواع المشروعات والأعمال والمشروعات والشركات (إضافة / تعديل / مسح) — كل حركة ومعاها سطر audit في نفس الـ transaction.
 * الكود بيتكتب في الإضافة بس؛ التعديل بيغير الحقول التانية.
 */
type Tx = Prisma.TransactionClient;
const sel = { select: { id: true } } as const;

function createIn(tx: Tx, d: OrgData, code: string): Promise<{ id: string }> {
  switch (d.kind) {
    case "presidency": return tx.presidency.create({ data: { code, ...d.fields }, ...sel });
    case "sector": return tx.sector.create({ data: { code, ...d.fields }, ...sel });
    case "techUnit": return tx.techUnit.create({ data: { code, ...d.fields }, ...sel });
    case "generalDept": return tx.generalDept.create({ data: { code, ...d.fields }, ...sel });
    case "dept": return tx.dept.create({ data: { code, ...d.fields }, ...sel });
    case "central": return tx.central.create({ data: { code, ...d.fields }, ...sel });
    case "projectType": return tx.projectType.create({ data: { code, ...d.fields }, ...sel });
    case "workType": return tx.workType.create({ data: { code, ...d.fields }, ...sel });
    case "project": return tx.project.create({ data: { code, ...d.fields }, ...sel });
    case "company": return tx.company.create({ data: { code, ...d.fields }, ...sel });
  }
}

function updateIn(tx: Tx, id: string, d: OrgData): Promise<{ id: string }> {
  const where = { id };
  switch (d.kind) {
    case "presidency": return tx.presidency.update({ where, data: d.fields, ...sel });
    case "sector": return tx.sector.update({ where, data: d.fields, ...sel });
    case "techUnit": return tx.techUnit.update({ where, data: d.fields, ...sel });
    case "generalDept": return tx.generalDept.update({ where, data: d.fields, ...sel });
    case "dept": return tx.dept.update({ where, data: d.fields, ...sel });
    case "central": return tx.central.update({ where, data: d.fields, ...sel });
    case "projectType": return tx.projectType.update({ where, data: d.fields, ...sel });
    case "workType": return tx.workType.update({ where, data: d.fields, ...sel });
    case "project": return tx.project.update({ where, data: d.fields, ...sel });
    case "company": return tx.company.update({ where, data: d.fields, ...sel });
  }
}

function deleteIn(tx: Tx, kind: OrgKind, id: string): Promise<unknown> {
  const where = { id };
  switch (kind) {
    case "presidency": return tx.presidency.delete({ where });
    case "sector": return tx.sector.delete({ where });
    case "techUnit": return tx.techUnit.delete({ where });
    case "generalDept": return tx.generalDept.delete({ where });
    case "dept": return tx.dept.delete({ where });
    case "central": return tx.central.delete({ where });
    case "projectType": return tx.projectType.delete({ where });
    case "workType": return tx.workType.delete({ where });
    case "project": return tx.project.delete({ where });
    case "company": return tx.company.delete({ where });
  }
}

type Named = { code: string; name: string } | null;

export function findEntity(kind: OrgKind, id: string): Promise<Named> {
  const q = { where: { id }, select: { code: true, name: true } } as const;
  switch (kind) {
    case "presidency": return prisma.presidency.findUnique(q);
    case "sector": return prisma.sector.findUnique(q);
    case "techUnit": return prisma.techUnit.findUnique(q);
    case "generalDept": return prisma.generalDept.findUnique(q);
    case "dept": return prisma.dept.findUnique(q);
    case "central": return prisma.central.findUnique(q);
    case "projectType": return prisma.projectType.findUnique(q);
    case "workType": return prisma.workType.findUnique(q);
    case "project": return prisma.project.findUnique(q);
    case "company": return prisma.company.findUnique(q);
  }
}

/** نوع النطاق في user_roles المقابل لكل كيان (لو فيه) */
const SCOPE_OF: Partial<Record<OrgKind, ScopeType>> = {
  presidency: "presidency",
  sector: "sector",
  generalDept: "general_dept",
  dept: "dept",
  central: "central",
  company: "company",
};

/** البيانات اللي تحت الكيان — لو أي عدد > 0 مينفعش يتمسح */
export async function countDependents(kind: OrgKind, id: string): Promise<{ label: string; n: number }[]> {
  const scope = SCOPE_OF[kind];
  const users = scope
    ? [{ label: "صلاحية مستخدم على النطاق", n: await prisma.userRole.count({ where: { scopeType: scope, scopeId: id } }) }]
    : [];
  const c = async (label: string, n: Promise<number>) => ({ label, n: await n });
  switch (kind) {
    case "presidency":
      return [await c("قطاع", prisma.sector.count({ where: { presidencyId: id } })), ...users];
    case "sector":
      return [
        await c("شئون فنية", prisma.techUnit.count({ where: { sectorId: id } })),
        await c("إدارة عامة", prisma.generalDept.count({ where: { sectorId: id } })),
        ...users,
      ];
    case "techUnit":
      return [];
    case "generalDept":
      return [await c("إدارة مختصة", prisma.dept.count({ where: { generalDeptId: id } })), ...users];
    case "dept":
      return [await c("سنترال", prisma.central.count({ where: { deptId: id } })), ...users];
    case "central":
      return [await c("مشروع", prisma.project.count({ where: { centralId: id } })), ...users];
    case "projectType":
      return [
        await c("مشروع", prisma.project.count({ where: { typeId: id } })),
        await c("مستند إلزامي متظبط على النوع", prisma.requiredDoc.count({ where: { projectTypeId: id } })),
      ];
    case "workType":
      // كل المستخلصات (مش النطاق بس) — المسح بيأثر على المنظومة كلها
      return [await c("مستخلص", prisma.invoice.count({ where: { workTypeId: id } }))];
    case "project":
      return [await c("أمر تكليف", prisma.assignmentOrder.count({ where: { projectId: id } }))];
    case "company":
      return [await c("عقد", prisma.contract.count({ where: { companyId: id } })), ...users];
  }
}

export function createEntity(d: OrgData, code: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const rec = await createIn(tx, d, code);
    await tx.auditLog.create({ data: { userId, action: "org.create", entity: d.kind, entityId: rec.id, details: { code } } });
    return rec;
  });
}

export function updateEntity(id: string, d: OrgData, userId: string) {
  return prisma.$transaction(async (tx) => {
    const rec = await updateIn(tx, id, d);
    await tx.auditLog.create({
      data: { userId, action: "org.update", entity: d.kind, entityId: id, details: JSON.parse(JSON.stringify(d.fields)) },
    });
    return rec;
  });
}

export function deleteEntity(kind: OrgKind, id: string, before: { code: string; name: string }, userId: string) {
  return prisma.$transaction(async (tx) => {
    await deleteIn(tx, kind, id);
    await tx.auditLog.create({ data: { userId, action: "org.delete", entity: kind, entityId: id, details: before } });
  });
}
