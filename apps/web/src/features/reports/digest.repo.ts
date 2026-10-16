import "server-only";
import { prisma, type Role } from "@it/db";

/**
 * حجز تشغيل مرة واحدة في اليوم (حتى لو فيه أكتر من نسخة من الخدمة أو اتعمل restart):
 * الصف بيتكتب بس لو قيمته مختلفة عن النهارده — وعدد الصفوف المتأثرة بيقول مين اللي حجز.
 */
export async function claimRun(key: string, date: string): Promise<boolean> {
  const value = JSON.stringify(date);
  const n = await prisma.$executeRaw`
    INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${value}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    WHERE settings.value IS DISTINCT FROM EXCLUDED.value`;
  return n === 1;
}

export async function lastRun(key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key }, select: { value: true } });
  return typeof s?.value === "string" ? s.value : null;
}

/** المستخلصات قيد المراجعة (لحساب المتأخر) */
export function listActiveInvoices() {
  return prisma.invoice.findMany({
    where: { status: "active" },
    select: {
      id: true,
      invoiceNo: true,
      currentStep: true,
      category: true,
      suggestedCategory: true,
      since: true,
      contract: { select: { company: { select: { id: true, name: true } } } },
      ao: {
        select: {
          project: {
            select: {
              central: {
                select: {
                  id: true,
                  name: true,
                  dept: { select: { id: true, name: true, generalDept: { select: { id: true, name: true, sector: { select: { id: true, name: true, presidency: { select: { id: true, name: true } } } } } } } },
                },
              },
            },
          },
        },
      },
    },
  });
}

/** المستخدمين النشطين بأدوار معيّنة (بأدوارهم ونطاقاتهم كاملة) */
export function listUsersWithRoles(roles: Role[]) {
  return prisma.user.findMany({
    where: { active: true, roles: { some: { role: { in: roles } } } },
    select: { id: true, name: true, email: true, roles: { select: { role: true, scopeType: true, scopeId: true } } },
  });
}

export function queueEmails(rows: { toEmail: string; toName: string; subject: string; body: string }[]) {
  if (!rows.length) return Promise.resolve({ count: 0 });
  return prisma.emailOutbox.createMany({ data: rows.map((r) => ({ ...r, status: "pending" as const })) });
}
