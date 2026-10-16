import "server-only";
import { prisma, Prisma } from "@it/db";

/**
 * قراءة مستخلص واحد بكل تفاصيله + الأرقام المقارنة من أمر التكليف والمستخلصات السابقة.
 * النطاق بييجي جاهز من الـ service في `where` — الـ repo ما يقررش مين يشوف إيه.
 */

const orgChain = {
  select: {
    id: true,
    name: true,
    dept: {
      select: {
        id: true,
        name: true,
        generalDept: {
          select: { id: true, name: true, sector: { select: { id: true, name: true, presidency: { select: { id: true, name: true } } } } },
        },
      },
    },
  },
} as const;

const revisionLines = {
  orderBy: { sort: "asc" },
  select: {
    id: true,
    contractItemId: true,
    newItemNo: true,
    newDescription: true,
    newUnit: true,
    agreedPrice: true,
    qty: true,
    approvedQty: true,
    approveNote: true,
    sort: true,
    site: { select: { id: true, code: true } },
    contractItem: { select: { itemNo: true, description: true, unit: true, unitPrice: true, workType: true } },
  },
} satisfies Prisma.InvoiceRevision$linesArgs;

const detailSelect = {
  id: true,
  invoiceNo: true,
  seq: true,
  period: true,
  pathName: true,
  status: true,
  currentStep: true,
  since: true,
  category: true,
  suggestedCategory: true,
  returnTo: true,
  returnedFrom: true,
  heldAt: true,
  holdReason: true,
  submittedAt: true,
  paidAt: true,
  paymentRef: true,
  paymentMethod: true,
  paymentAmount: true,
  migrated: true,
  migratedAmount: true,
  deductionsSet: true,
  createdAt: true,
  workType: { select: { id: true, name: true, isPlanning: true } },
  contract: {
    select: {
      id: true,
      contractNo: true,
      title: true,
      currency: true,
      vatPct: true,
      payMonthlyPct: true,
      payAsbuiltPct: true,
      payHandoverPct: true,
      planningPayPct: true,
      taxPct: true,
      company: { select: { id: true, name: true, fullName: true } },
    },
  },
  ao: {
    select: {
      id: true,
      aoNo: true,
      name: true,
      value: true,
      financialCommitment: true,
      project: { select: { id: true, name: true, type: { select: { id: true, name: true } }, central: orgChain } },
    },
  },
  revisions: {
    orderBy: { n: "asc" },
    select: {
      id: true,
      n: true,
      note: true,
      createdAt: true,
      _count: { select: { lines: true, materials: true, attachments: true } },
    },
  },
  deductions: {
    orderBy: { id: "asc" },
    select: {
      id: true, type: true, name: true, pct: true, amount: true, note: true, releasable: true,
      releasedAt: true, releaseRef: true, releaseMethod: true, releaseNote: true, releasedBy: { select: { name: true } },
    },
  },
  log: {
    orderBy: { at: "asc" },
    select: {
      id: true,
      action: true,
      fromStep: true,
      toStep: true,
      category: true,
      note: true,
      onBehalf: true,
      at: true,
      by: { select: { id: true, name: true } },
      reasons: { select: { reason: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.InvoiceSelect;

export type InvoiceDetail = Prisma.InvoiceGetPayload<{ select: typeof detailSelect }>;

export function findInvoiceDetail(id: string, where: Prisma.InvoiceWhereInput): Promise<InvoiceDetail | null> {
  return prisma.invoice.findFirst({ where: { AND: [{ id }, where] }, select: detailSelect });
}

/** محتوى نسخة (البنود والمهمات والمرفقات) */
export function findRevisionContent(revisionId: string) {
  return prisma.invoiceRevision.findUnique({
    where: { id: revisionId },
    select: {
      id: true,
      n: true,
      lines: revisionLines,
      materials: {
        orderBy: { material: { code: "asc" } },
        select: { id: true, materialId: true, executedQty: true, billedQty: true, material: { select: { code: true, description: true, unit: true } } },
      },
      attachments: {
        orderBy: { uploadedAt: "asc" },
        select: { id: true, fileName: true, mimeType: true, size: true, uploadedAt: true, docType: { select: { id: true, name: true } } },
      },
    },
  });
}
export type RevisionContent = NonNullable<Awaited<ReturnType<typeof findRevisionContent>>>;

/** هل المستخلص ده في الـ where ده؟ (للصلاحيات) */
export async function invoiceMatches(id: string, where: Prisma.InvoiceWhereInput): Promise<boolean> {
  return (await prisma.invoice.count({ where: { AND: [{ id }, where] } })) > 0;
}

// ── المقارنة بأمر التكليف والمستخلصات السابقة ─────────────────────────

export type QtyRow = { key: string; qty: string };

/** الكمية المخططة لكل بند عقد في أمر التكليف (كل المواقع) */
export async function plannedByItem(aoId: string): Promise<Map<string, number>> {
  const rows = await prisma.aoItem.groupBy({ by: ["contractItemId"], where: { aoId }, _sum: { plannedQty: true } });
  return new Map(rows.map((r) => [r.contractItemId, Number(r._sum.plannedQty ?? 0)]));
}

/**
 * المعتمد من كل بند في المستخلصات الأقدم (seq أصغر) غير المسودة على نفس أمر التكليف — من آخر نسخة لكل مستخلص.
 * البند المستجد مفتاحه "new:<رقم>".
 */
export async function prevQtyByItem(aoId: string, seq: number, invoiceId: string | null): Promise<Map<string, { qty: number; value: number }>> {
  const rows = await prisma.$queryRaw<(QtyRow & { value: string })[]>`
    SELECT COALESCE(l.contract_item_id, 'new:' || l.new_item_no) AS key,
           SUM(COALESCE(l.approved_qty, l.qty))::text AS qty,
           SUM(COALESCE(l.approved_qty, l.qty) * COALESCE(ci.unit_price, l.agreed_price, 0))::text AS value
    FROM invoices i
    JOIN invoice_revisions r ON r.id = (SELECT r2.id FROM invoice_revisions r2 WHERE r2.invoice_id = i.id ORDER BY r2.n DESC LIMIT 1)
    JOIN invoice_lines l ON l.revision_id = r.id
    LEFT JOIN contract_items ci ON ci.id = l.contract_item_id
    WHERE i.ao_id = ${aoId} AND i.status <> 'draft' AND i.seq < ${seq} AND i.id <> ${invoiceId ?? ""}
    GROUP BY 1`;
  return new Map(rows.map((r) => [r.key, { qty: Number(r.qty), value: Number(r.value) }]));
}

/** المهمات: المخطط في أمر التكليف، والمنصرف (ناقص المرتجع)، والمنفذ في المستخلصات السابقة */
export async function materialFigures(aoId: string, seq: number, invoiceId: string | null) {
  const [planned, issued, prev] = await Promise.all([
    prisma.aoMaterial.findMany({ where: { aoId }, select: { materialId: true, plannedQty: true } }),
    prisma.$queryRaw<QtyRow[]>`
      SELECT material_id AS key, SUM(qty - returned_qty)::text AS qty FROM material_issues WHERE ao_id = ${aoId} GROUP BY 1`,
    prisma.$queryRaw<QtyRow[]>`
      SELECT m.material_id AS key, SUM(COALESCE(m.billed_qty, m.executed_qty))::text AS qty
      FROM invoices i
      JOIN invoice_revisions r ON r.id = (SELECT r2.id FROM invoice_revisions r2 WHERE r2.invoice_id = i.id ORDER BY r2.n DESC LIMIT 1)
      JOIN invoice_materials m ON m.revision_id = r.id
      WHERE i.ao_id = ${aoId} AND i.status <> 'draft' AND i.seq < ${seq} AND i.id <> ${invoiceId ?? ""}
      GROUP BY 1`,
  ]);
  return {
    planned: new Map(planned.map((p) => [p.materialId, Number(p.plannedQty)])),
    issued: new Map(issued.map((r) => [r.key, Number(r.qty)])),
    prev: new Map(prev.map((r) => [r.key, Number(r.qty)])),
  };
}

/**
 * القيمة المعتمدة (الكمية المعتمدة × السعر) لكل مستخلص غير مسودة على أمر التكليف — من آخر نسخة.
 * المستخلص المرحّل من غير بنود بيتحسب بقيمته المرحّلة.
 */
export function grossByInvoiceOnAo(aoId: string): Promise<{ id: string; seq: number; gross: string }[]> {
  return prisma.$queryRaw`
    SELECT i.id, i.seq,
           (CASE WHEN i.migrated THEN COALESCE(i.migrated_amount, 0) ELSE COALESCE(x.total, 0) END)::text AS gross
    FROM invoices i
    LEFT JOIN LATERAL (
      SELECT SUM(COALESCE(l.approved_qty, l.qty) * COALESCE(ci.unit_price, l.agreed_price, 0)) AS total
      FROM invoice_lines l
      LEFT JOIN contract_items ci ON ci.id = l.contract_item_id
      WHERE l.revision_id = (SELECT r.id FROM invoice_revisions r WHERE r.invoice_id = i.id ORDER BY r.n DESC LIMIT 1)
    ) x ON true
    WHERE i.ao_id = ${aoId} AND i.status <> 'draft'`;
}

/** قيمة أمر التكليف الحالية: القيمة المسجلة، ولو مش موجودة قيمة الكميات المخططة */
export async function plannedValue(aoId: string): Promise<number> {
  const [row] = await prisma.$queryRaw<{ v: string | null }[]>`
    SELECT SUM(a.planned_qty * COALESCE(ci.unit_price, 0))::text AS v
    FROM ao_items a JOIN contract_items ci ON ci.id = a.contract_item_id WHERE a.ao_id = ${aoId}`;
  return Number(row?.v ?? 0);
}

/** المستندات الإلزامية لنوع المشروع */
export function requiredDocsFor(projectTypeId: string) {
  return prisma.requiredDoc.findMany({
    where: { projectTypeId },
    select: { stage: true, docType: { select: { id: true, name: true } } },
    orderBy: { docType: { name: "asc" } },
  });
}

export function listInvoiceEmails(invoiceId: string) {
  return prisma.emailOutbox.findMany({
    where: { invoiceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, toEmail: true, toName: true, subject: true, body: true, status: true, createdAt: true, sentAt: true, lastError: true },
  });
}

export function listActiveReturnReasons() {
  return prisma.returnReason.findMany({ where: { active: true }, orderBy: [{ sort: "asc" }, { name: "asc" }], select: { id: true, name: true } });
}

/**
 * المستخدمين المسؤولين عن دور معيّن لمستخلص: الدور ده بنطاق بيغطي الكيان (الكل، أو الشركة، أو أي مستوى في الهيكل).
 * التفويض: لو المسؤول مفوّض حد النهارده، البديل بيتضاف.
 */
export async function findRoleHolders(
  role: Prisma.UserRoleWhereInput["role"],
  scopes: { type: "company" | "presidency" | "sector" | "general_dept" | "dept" | "central"; id: string | null | undefined }[],
  today: Date,
): Promise<{ id: string; name: string; email: string }[]> {
  const ors: Prisma.UserRoleWhereInput[] = [{ scopeType: "all" }];
  for (const s of scopes) if (s.id) ors.push({ scopeType: s.type, scopeId: s.id });
  const users = await prisma.user.findMany({
    where: { active: true, roles: { some: { role, OR: ors } } },
    select: {
      id: true,
      name: true,
      email: true,
      delegationsFrom: {
        where: { startsOn: { lte: today }, endsOn: { gte: today }, toUser: { active: true } },
        select: { toUser: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: { name: "asc" },
  });
  const out = new Map<string, { id: string; name: string; email: string }>();
  for (const u of users) {
    out.set(u.id, { id: u.id, name: u.name, email: u.email });
    for (const d of u.delegationsFrom) out.set(d.toUser.id, d.toUser);
  }
  return [...out.values()];
}
