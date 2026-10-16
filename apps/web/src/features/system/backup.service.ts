import "server-only";
import { backupAlertEmail, backupHealth, type BackupHealth } from "@it/domain";
import { connection } from "next/server";
import { claimRun, listUsersWithRoles, queueEmails } from "@/features/reports/digest.repo";
import { readBackupStatus } from "./backup.repo";

const ALERT_KEY = "backup.alert.last";

export async function getBackupHealth(): Promise<BackupHealth> {
  await connection();
  return backupHealth(await readBackupStatus(), new Date());
}

/**
 * تنبيه مدير النظام مرة واحدة في اليوم لو النسخ الاحتياطي فشل أو اتأخر.
 * "never" (بيئة تطوير أو أول تشغيل قبل أول نسخة) مابيبعتش حاجة — بيظهر في الصفحة الرئيسية بس.
 */
export async function runBackupCheck(date: string): Promise<number> {
  const h = backupHealth(await readBackupStatus(), new Date());
  if (h.k === "never" || h.k === "ok") return 0;
  if (!(await claimRun(ALERT_KEY, date))) return 0;
  const admins = await listUsersWithRoles(["admin"]);
  await queueEmails(admins.map((u) => ({ toEmail: u.email, toName: u.name, ...backupAlertEmail(h, u.name) })));
  return admins.length;
}
