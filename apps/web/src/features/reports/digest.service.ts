import "server-only";
import { isWorkingDay, localDate, slaState } from "@it/domain";
import type { Role } from "@it/db";
import { scopeEntityNames } from "@/features/auth/auth.repo";
import type { SessionUser } from "@/features/auth/auth.types";
import { getFlowContext, isCategoryCode } from "@/features/invoices/flow-config";
import { recipientsFor } from "@/features/invoices/flow-notify";
import { getSettings } from "@/features/workflow/workflow.repo";
import { readSettings } from "@/features/workflow/workflow.rules";
import { runBackupCheck } from "@/features/system/backup.service";
import { env } from "@/lib/env";
import { cairoNow, dailyDigestEmail, isDue, weeklyReportEmail, type LateItem } from "./digest.rules";
import { claimRun, lastRun, listActiveInvoices, listUsersWithRoles, queueEmails } from "./digest.repo";
import { buildReport } from "./reports.service";

const DAILY_KEY = "digest.daily.last";
const WEEKLY_KEY = "digest.weekly.last";
const BACKUP_CHECK_AT = "09:00";
const WEEKLY_ROLES: Role[] = ["pmo", "sector_head", "gm"];

/** الملخص اليومي: كل مسؤول عنده مستخلصات متأخرة بس يوصله إيميل بيها */
export async function runDailyDigest(): Promise<number> {
  const ctx = await getFlowContext();
  const today = localDate(new Date());
  const byUser = new Map<string, { name: string; email: string; items: LateItem[] }>();
  for (const inv of await listActiveInvoices()) {
    const st = slaState(
      {
        status: "active",
        since: localDate(inv.since),
        currentStep: inv.currentStep,
        category: isCategoryCode(inv.category) ? inv.category : null,
        suggestedCategory: isCategoryCode(inv.suggestedCategory) ? inv.suggestedCategory : null,
      },
      today,
      ctx.config,
      ctx.holidays,
      ctx.warnAt,
    );
    if (st.k !== "late" || st.elapsed == null || st.sla == null) continue;
    const holders = await recipientsFor(ctx, inv, inv.currentStep, "");
    for (const h of holders) {
      const e = byUser.get(h.id) ?? { name: h.name, email: h.email, items: [] };
      e.items.push({
        invoiceNo: inv.invoiceNo,
        company: inv.contract.company.name,
        step: ctx.config.steps[inv.currentStep ?? ""]?.short ?? inv.currentStep ?? "",
        elapsed: st.elapsed,
        sla: st.sla,
        url: `${env.appUrl}/invoices/${inv.id}`,
      });
      byUser.set(h.id, e);
    }
  }
  const emails = [...byUser.values()].map((u) => ({ toEmail: u.email, toName: u.name, ...dailyDigestEmail(u.name, u.items, `${env.appUrl}/inbox`) }));
  await queueEmails(emails);
  return emails.length;
}

/** التقرير الأسبوعي: PMO ورؤساء القطاعات والمديرين العموم — كل واحد بمؤشرات نطاقه */
export async function runWeeklyReport(): Promise<number> {
  const users = await listUsersWithRoles(WEEKLY_ROLES);
  const names = await scopeEntityNames(users.flatMap((u) => u.roles));
  const emails = [];
  for (const u of users) {
    const user: SessionUser = { id: u.id, name: u.name, email: u.email, roles: u.roles };
    const report = await buildReport(user, {});
    const scope =
      u.roles.some((r) => r.scopeType === "all") ? "جميع الجهات"
      : [...new Set(u.roles.filter((r) => WEEKLY_ROLES.includes(r.role)).map((r) => names.get(`${r.scopeType}:${r.scopeId}`)).filter(Boolean))].join("، ") || "نطاقكم";
    const late = report.rows.filter((r) => r.sla.k === "late").length;
    emails.push({ toEmail: u.email, toName: u.name, ...weeklyReportEmail(u.name, scope, report.kpis, { late, stepNames: report.steps }, `${env.appUrl}/reports`) });
  }
  await queueEmails(emails);
  return emails.length;
}

/** دقة دقيقة: بيشوف لو جه وقت الملخص اليومي / التقرير الأسبوعي */
export async function digestTick(now = cairoNow()): Promise<void> {
  const settings = readSettings(await getSettings());
  const ctx = await getFlowContext();
  if (isWorkingDay(now.date, ctx.holidays) && isDue(now, settings.dailyDigestAt, await lastRun(DAILY_KEY)) && (await claimRun(DAILY_KEY, now.date))) {
    console.log(`[digest] daily: ${await runDailyDigest()} email(s)`);
  }
  if (now.weekday === settings.weeklyReportDay && isDue(now, settings.dailyDigestAt, await lastRun(WEEKLY_KEY)) && (await claimRun(WEEKLY_KEY, now.date))) {
    console.log(`[digest] weekly: ${await runWeeklyReport()} email(s)`);
  }
  // النسخ الاحتياطي (02:15) — التنبيه بعد بداية اليوم، مرة واحدة في اليوم بحد أقصى
  if (now.time >= BACKUP_CHECK_AT) {
    const n = await runBackupCheck(now.date);
    if (n) console.log(`[digest] backup alert: ${n} email(s)`);
  }
}

export function startDigestScheduler(): void {
  const g = globalThis as { __digestTimer?: ReturnType<typeof setInterval> };
  if (g.__digestTimer) return;
  g.__digestTimer = setInterval(() => {
    digestTick().catch((e) => console.error("[digest]", e));
  }, 60_000);
}
