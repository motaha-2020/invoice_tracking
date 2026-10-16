import type { BackupHealth } from "@it/domain";
import { backupErrorLabel } from "@it/domain";
import { Alert, Num } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

const mb = (b: number | null) => (b == null ? "—" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

/** حالة النسخ الاحتياطي اليومي — لمدير النظام بس (الصفحة الرئيسية) */
export function BackupStatus({ h }: { h: BackupHealth }) {
  if (h.k === "never") {
    return (
      <Alert tone="i" title="النسخ الاحتياطي اليومي" className="mb-4">
        لم تُسجَّل أي نسخة احتياطية بعد. تتم جدولة النسخ تلقائياً مع أول نشر على السيرفر (يومياً 02:15).
      </Alert>
    );
  }
  const s = h.status;
  const last = s.okAt ? <>آخر نسخة ناجحة <Num>{formatDateTime(s.okAt)}</Num></> : "لا توجد نسخة ناجحة";
  const size = <>قاعدة البيانات <Num>{mb(s.dbBytes)}</Num> · المرفقات <Num>{mb(s.uploadsBytes)}</Num>{s.copies != null && <> · <Num>{s.copies}</Num> نسخة محفوظة</>}</>;
  if (h.k === "ok") {
    return (
      <Alert tone="g" title="النسخ الاحتياطي اليومي يعمل" className="mb-4">
        {last} · {size}
      </Alert>
    );
  }
  return (
    <Alert tone="r" title={h.k === "failed" ? "فشل النسخ الاحتياطي اليومي" : "تأخر النسخ الاحتياطي اليومي"} className="mb-4">
      {h.k === "failed" && <>آخر محاولة <Num>{formatDateTime(s.at)}</Num>: {backupErrorLabel(s.error)}. </>}
      {last}{h.ageHours != null && <> (منذ <Num>{Math.floor(h.ageHours)}</Num> ساعة)</>}. يرجى مراجعة سجل النسخ على السيرفر.
    </Alert>
  );
}
