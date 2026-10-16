import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@it/db";
import { z } from "zod";
import type { SessionUser } from "@/features/auth/auth.types";
import { listOrgLevels } from "@/features/org/org.repo";
import { AppError } from "@/lib/errors";
import { canManageRecords } from "./records.service";

/**
 * ربط أمر التكليف بمكانه في الهيكل (مدير النظام فقط).
 * المكان بيتحدد بالمشروع: المشروع ← السنترال ← الإدارة المختصة ← العامة ← القطاع ← الرئاسة، فاختيار السنترال
 * والمشروع كفاية. ولو السنترال أو المشروع مش متسجلين، بيتعملوا هنا بكود تلقائي.
 * كل مستخلصات أمر التكليف بتاخد نفس المكان (نطاق الاطلاع والبريد والتقارير).
 */
export type Opt = { id: string; name: string; parentId?: string };

export type LocationOptions = {
  presidencies: Opt[];
  sectors: Opt[];
  generalDepts: Opt[];
  depts: Opt[];
  centrals: Opt[];
  projects: Opt[];
  projectTypes: Opt[];
};

/** المسار الحالي (ids) لأمر التكليف — فاضي لو مش مربوط */
export type LocationPath = { presidencyId: string; sectorId: string; generalDeptId: string; deptId: string; centralId: string; projectId: string };

export async function getLocationOptions(user: SessionUser): Promise<LocationOptions | null> {
  if (!(await canManageRecords(user))) return null;
  const [[pres, sectors, , gds, depts, centrals], projects, types] = await Promise.all([
    listOrgLevels(),
    prisma.project.findMany({ select: { id: true, code: true, name: true, centralId: true }, orderBy: { name: "asc" } }),
    prisma.projectType.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    presidencies: pres.map((x) => ({ id: x.id, name: x.name })),
    sectors: sectors.map((x) => ({ id: x.id, name: x.name, parentId: x.presidencyId })),
    generalDepts: gds.map((x) => ({ id: x.id, name: x.name, parentId: x.sectorId })),
    depts: depts.map((x) => ({ id: x.id, name: x.name, parentId: x.generalDeptId })),
    centrals: centrals.map((x) => ({ id: x.id, name: x.name, parentId: x.deptId })),
    projects: projects.map((x) => ({ id: x.id, name: `${x.name} (${x.code})`, parentId: x.centralId })),
    projectTypes: types.map((x) => ({ id: x.id, name: x.name })),
  };
}

export async function getAoLocation(aoId: string): Promise<LocationPath | null> {
  const ao = await prisma.assignmentOrder.findUnique({
    where: { id: aoId },
    select: { project: { select: { id: true, central: { select: { id: true, dept: { select: { id: true, generalDept: { select: { id: true, sector: { select: { id: true, presidencyId: true } } } } } } } } } } },
  });
  const p = ao?.project;
  if (!p) return null;
  const c = p.central;
  return {
    presidencyId: c.dept.generalDept.sector.presidencyId,
    sectorId: c.dept.generalDept.sector.id,
    generalDeptId: c.dept.generalDept.id,
    deptId: c.dept.id,
    centralId: c.id,
    projectId: p.id,
  };
}

export const locationSchema = z
  .object({
    /** مشروع موجود — أو "new" */
    projectId: z.string().min(1, "يرجى اختيار المشروع").max(64),
    /** سنترال موجود — أو "new" (لازم مع المشروع الجديد) */
    centralId: z.string().max(64).default(""),
    deptId: z.string().max(64).default(""),
    newCentralName: z.string().trim().max(200).default(""),
    newProjectName: z.string().trim().max(300).default(""),
    projectTypeId: z.string().max(64).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.projectId !== "new") return;
    if (!v.newProjectName) ctx.addIssue({ code: "custom", message: "يرجى إدخال اسم المشروع الجديد" });
    if (!v.projectTypeId) ctx.addIssue({ code: "custom", message: "يرجى اختيار نوع المشروع" });
    if (!v.centralId) ctx.addIssue({ code: "custom", message: "يرجى اختيار السنترال" });
    if (v.centralId === "new" && (!v.newCentralName || !v.deptId)) ctx.addIssue({ code: "custom", message: "يرجى اختيار الإدارة المختصة وإدخال اسم السنترال الجديد" });
  });

export type LocationInput = z.input<typeof locationSchema>;

const autoCode = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`;

export async function setAoLocation(user: SessionUser, aoId: string, input: unknown): Promise<string> {
  if (!(await canManageRecords(user))) throw new AppError("FORBIDDEN", "ربط أوامر التكليف بالهيكل متاح لمدير النظام فقط");
  const r = locationSchema.safeParse(input);
  if (!r.success) throw new AppError("VALIDATION", r.error.issues[0]?.message ?? "يرجى مراجعة البيانات");
  const v = r.data;
  const ao = await prisma.assignmentOrder.findUnique({ where: { id: aoId }, select: { aoNo: true, projectId: true, _count: { select: { invoices: true } } } });
  if (!ao) throw new AppError("NOT_FOUND", "أمر التكليف غير موجود");

  return prisma.$transaction(async (tx) => {
    let projectId = v.projectId;
    const created: string[] = [];
    if (projectId === "new") {
      let centralId = v.centralId;
      if (centralId === "new") {
        if (!(await tx.dept.findUnique({ where: { id: v.deptId }, select: { id: true } }))) throw new AppError("NOT_FOUND", "الإدارة المختصة غير موجودة");
        centralId = (await tx.central.create({ data: { code: autoCode("CEN"), name: v.newCentralName, deptId: v.deptId }, select: { id: true } })).id;
        created.push(`سنترال «${v.newCentralName}»`);
      } else if (!(await tx.central.findUnique({ where: { id: centralId }, select: { id: true } }))) {
        throw new AppError("NOT_FOUND", "السنترال غير موجود");
      }
      projectId = (await tx.project.create({ data: { code: autoCode("PJ"), name: v.newProjectName, typeId: v.projectTypeId, centralId }, select: { id: true } })).id;
      created.push(`مشروع «${v.newProjectName}»`);
    } else if (!(await tx.project.findUnique({ where: { id: projectId }, select: { id: true } }))) {
      throw new AppError("NOT_FOUND", "المشروع غير موجود");
    }
    await tx.assignmentOrder.update({ where: { id: aoId }, data: { projectId }, select: { id: true } });
    await tx.auditLog.create({
      data: { userId: user.id, action: "ao.location", entity: "ao", entityId: aoId, details: { aoNo: ao.aoNo, from: ao.projectId, to: projectId, created } },
    });
    const extra = created.length ? ` وإنشاء ${created.join(" و")}` : "";
    return `تم ربط أمر التكليف ${ao.aoNo} بالهيكل${extra} — يسري على ${ao._count.invoices} مستخلص`;
  });
}
