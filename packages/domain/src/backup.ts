/**
 * حالة النسخ الاحتياطي اليومي — infra/backup.sh بيكتبها في settings (backup.status) بعد كل محاولة.
 * الـ cron بيشتغل يومياً 02:15، فأي نسخة ناجحة أقدم من BACKUP_MAX_AGE_HOURS معناها إن الجدولة واقفة.
 */
export const BACKUP_MAX_AGE_HOURS = 30;

export type BackupStatus = {
  ok: boolean;
  at: string;
  okAt: string | null;
  error: string | null;
  dbBytes: number | null;
  uploadsBytes: number | null;
  copies: number | null;
};

export type BackupHealth =
  | { k: 'never' }
  | { k: 'ok' | 'stale' | 'failed'; status: BackupStatus; ageHours: number | null };

const ERROR_LABELS: Record<string, string> = {
  pg_dump: 'تعذر نسخ قاعدة البيانات',
  verify_db: 'ملف نسخة قاعدة البيانات غير صالح',
  uploads: 'تعذر نسخ المرفقات',
  verify_uploads: 'أرشيف المرفقات غير صالح',
  cleanup: 'تعذر حذف النسخ القديمة',
  init: 'تعذر بدء النسخ',
};

export const backupErrorLabel = (step: string | null) => (step ? (ERROR_LABELS[step] ?? step) : '');

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** قراءة آمنة لقيمة الـ JSON (ممكن تبقى ناقصة أو مكتوبة يدوي) */
export function parseBackupStatus(v: unknown): BackupStatus | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const at = str(o.at);
  if (!at || Number.isNaN(Date.parse(at))) return null;
  const okAt = str(o.okAt);
  return {
    ok: o.ok === true,
    at,
    okAt: okAt && !Number.isNaN(Date.parse(okAt)) ? okAt : null,
    error: str(o.error),
    dbBytes: num(o.dbBytes),
    uploadsBytes: num(o.uploadsBytes),
    copies: num(o.copies),
  };
}

/**
 * - failed: آخر محاولة فشلت (حتى لو فيه نسخة قديمة ناجحة).
 * - stale: آخر نسخة ناجحة أقدم من الحد (أو مفيش نجاح خالص).
 * - ok: غير كده.
 */
export function backupHealth(raw: unknown, now: Date, maxAgeHours = BACKUP_MAX_AGE_HOURS): BackupHealth {
  const status = parseBackupStatus(raw);
  if (!status) return { k: 'never' };
  const ageHours = status.okAt ? Math.max(0, (now.getTime() - Date.parse(status.okAt)) / 3_600_000) : null;
  if (!status.ok) return { k: 'failed', status, ageHours };
  if (ageHours == null || ageHours > maxAgeHours) return { k: 'stale', status, ageHours };
  return { k: 'ok', status, ageHours };
}

/** إيميل التنبيه لمدير النظام */
export function backupAlertEmail(h: Exclude<BackupHealth, { k: 'never' | 'ok' }>, name: string): { subject: string; body: string } {
  const age = h.ageHours == null ? 'لا توجد نسخة ناجحة مسجلة' : `آخر نسخة ناجحة منذ ${Math.floor(h.ageHours)} ساعة`;
  const why = h.k === 'failed' ? `فشلت آخر محاولة للنسخ الاحتياطي: ${backupErrorLabel(h.status.error)}.` : 'لم يتم تنفيذ النسخ الاحتياطي اليومي في موعده.';
  return {
    subject: h.k === 'failed' ? 'تنبيه: فشل النسخ الاحتياطي اليومي' : 'تنبيه: تأخر النسخ الاحتياطي اليومي',
    body: [
      `السيد/ ${name}،`,
      '',
      why,
      `${age}.`,
      '',
      'يرجى مراجعة السيرفر: سجل النسخ في /srv/invoices/backups/backup.log، وجدولة cron لمستخدم invoices-deploy.',
      'تفاصيل التشغيل والاسترجاع في infra/README.md (القسم 4).',
    ].join('\n'),
  };
}
