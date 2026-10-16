import "server-only";
import { prisma, type Prisma } from "@it/db";

/** قراءة بيانات التقارير — الـ where (النطاق + الفلتر) بييجي جاهز من الـ service */

const reportSelect = {
  id: true,
  invoiceNo: true,
  status: true,
  category: true,
  suggestedCategory: true,
  pathName: true,
  period: true,
  currentStep: true,
  returnTo: true,
  since: true,
  submittedAt: true,
  paidAt: true,
  paymentAmount: true,
  workType: { select: { name: true } },
  contract: { select: { id: true, contractNo: true, company: { select: { id: true, name: true } } } },
  ao: {
    select: {
      id: true,
      aoNo: true,
      value: true,
      project: {
        select: {
          name: true,
          central: {
            select: {
              name: true,
              dept: { select: { name: true, generalDept: { select: { name: true, sector: { select: { name: true, presidency: { select: { name: true } } } } } } } },
            },
          },
        },
      },
    },
  },
  log: {
    orderBy: { at: "asc" },
    select: { action: true, fromStep: true, toStep: true, at: true, reasons: { select: { reason: { select: { name: true } } } } },
  },
} satisfies Prisma.InvoiceSelect;

export type ReportInvoiceRow = Prisma.InvoiceGetPayload<{ select: typeof reportSelect }>;

export const REPORT_LIMIT = 5000;

export function loadReportInvoices(where: Prisma.InvoiceWhereInput): Promise<ReportInvoiceRow[]> {
  return prisma.invoice.findMany({ where, select: reportSelect, orderBy: [{ submittedAt: "desc" }, { id: "asc" }], take: REPORT_LIMIT });
}

const node = { id: true, name: true } as const;

/** قوائم الفلاتر (جداول صغيرة) */
export function loadFilterOptions() {
  return Promise.all([
    prisma.company.findMany({ select: node, orderBy: { name: "asc" } }),
    prisma.contract.findMany({ select: { id: true, contractNo: true, companyId: true }, orderBy: { contractNo: "asc" } }),
    prisma.presidency.findMany({ select: node, orderBy: { name: "asc" } }),
    prisma.sector.findMany({ select: { ...node, presidencyId: true }, orderBy: { name: "asc" } }),
    prisma.generalDept.findMany({ select: { ...node, sectorId: true }, orderBy: { name: "asc" } }),
    prisma.dept.findMany({ select: { ...node, generalDeptId: true }, orderBy: { name: "asc" } }),
    prisma.central.findMany({ select: { ...node, deptId: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ select: { ...node, centralId: true }, orderBy: { name: "asc" } }),
  ]);
}
