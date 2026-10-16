import "server-only";
import { getTransport, smtpInfo, FROM_NAME } from "./mailer";
import { MAX_ATTEMPTS, claimBatch, markFailed, markSent } from "./outbox.repo";

/**
 * مرسل البريد: كل 30 ثانية بياخد دفعة من email_outbox ويبعتها.
 * الفشل بيتسجل ويتعاد بعد attempts² دقيقة، وبعد 5 محاولات الرسالة بتبقى failed (وتتعاد من شاشة سجل البريد).
 */
const INTERVAL_MS = 30_000;
const BATCH = 20;

let running = false;

export async function dispatchOnce(): Promise<{ sent: number; failed: number }> {
  const t = getTransport();
  if (!t || running) return { sent: 0, failed: 0 };
  running = true;
  let sent = 0;
  let failed = 0;
  try {
    const from = { name: FROM_NAME, address: smtpInfo().from };
    for (const m of await claimBatch(BATCH)) {
      try {
        await t.sendMail({ from, to: m.toName ? { name: m.toName, address: m.toEmail } : m.toEmail, subject: m.subject, text: m.body });
        await markSent(m.id);
        sent++;
      } catch (e) {
        await markFailed(m.id, e instanceof Error ? e.message : String(e), m.attempts >= MAX_ATTEMPTS);
        failed++;
      }
    }
  } finally {
    running = false;
  }
  if (sent || failed) console.log(`[mail] sent=${sent} failed=${failed}`);
  return { sent, failed };
}

/** بيتنادي مرة واحدة من instrumentation.ts عند تشغيل السيرفر */
export function startDispatcher(): void {
  if (!smtpInfo().configured) {
    console.log("[mail] SMTP_HOST غير مضبوط — الرسائل تُحفظ في صندوق البريد الصادر دون إرسال");
    return;
  }
  const g = globalThis as { __mailTimer?: ReturnType<typeof setInterval> };
  if (g.__mailTimer) return;
  g.__mailTimer = setInterval(() => {
    dispatchOnce().catch((e) => console.error("[mail] dispatch", e));
  }, INTERVAL_MS);
  console.log(`[mail] مرسل البريد يعمل عبر ${smtpInfo().host}`);
}
