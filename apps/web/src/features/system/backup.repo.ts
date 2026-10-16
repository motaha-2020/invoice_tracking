import "server-only";
import { prisma } from "@it/db";

export const BACKUP_STATUS_KEY = "backup.status";

/** القيمة الخام اللي infra/backup.sh بيكتبها */
export async function readBackupStatus(): Promise<unknown> {
  const s = await prisma.setting.findUnique({ where: { key: BACKUP_STATUS_KEY }, select: { value: true } });
  return s?.value ?? null;
}
