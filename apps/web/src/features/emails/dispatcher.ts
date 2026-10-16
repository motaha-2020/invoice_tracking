import "server-only";
import { getMailer } from "./mailer";
import { MAX_ATTEMPTS, claimBatch, markFailed, markSent } from "./outbox.repo";
import { TEST_ADDRESS_NOTE, isReservedTestAddress } from "./smtp.rules";

/**
 * مرسل البريد: كل 30 ثانية بياخد دفعة من email_outbox ويبعتها.
 * الفشل بيتسجل ويتعاد بعد attempts² دقيقة، وبعد 5 محاولات الرسالة بتبقى failed (وتتعاد من شاشة سجل البريد).
 * الإعدادات بتتقري كل دورة — فتفعيل البريد أو تغييره من الشاشة بيشتغل من غير restart.
 */
const INTERVAL_MS = 30_000;
/** بيئة الاختبار (e2e على Mailpit) بس هي اللي بتبعت لعناوين ‎.test */
const DELIVER_TEST_ADDRESSES = process.env.MAIL_DELIVER_TEST_ADDRESSES === "1";
const BATCH = 20;

let running = false;
let lastState = "";

export async function dispatchOnce(): Promise<{ sent: number; failed: number }> {
  if (running) return { sent: 0, failed: 0 };
  const m = await getMailer();
  const state = m ? `on:${m.cfg.source}:${m.cfg.host}` : "off";
  if (state !== lastState) {
    console.log(m ? `[mail] مرسل البريد يعمل عبر ${m.cfg.host} (${m.cfg.source === "db" ? "إعدادات الشاشة" : "متغيرات البيئة"})` : "[mail] خادم البريد غير مضبوط — الرسائل تُحفظ في صندوق البريد الصادر دون إرسال");
    lastState = state;
  }
  if (!m) return { sent: 0, failed: 0 };
  running = true;
  let sent = 0;
  let failed = 0;
  try {
    for (const row of await claimBatch(BATCH)) {
      if (!DELIVER_TEST_ADDRESSES && isReservedTestAddress(row.toEmail)) {
        await markFailed(row.id, TEST_ADDRESS_NOTE, true);
        continue;
      }
      try {
        await m.t.sendMail({ from: m.from, to: row.toName ? { name: row.toName, address: row.toEmail } : row.toEmail, subject: row.subject, text: row.body });
        await markSent(row.id);
        sent++;
      } catch (e) {
        await markFailed(row.id, e instanceof Error ? e.message : String(e), row.attempts >= MAX_ATTEMPTS);
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
  const g = globalThis as { __mailTimer?: ReturnType<typeof setInterval> };
  if (g.__mailTimer) return;
  g.__mailTimer = setInterval(() => {
    dispatchOnce().catch((e) => console.error("[mail] dispatch", e));
  }, INTERVAL_MS);
  dispatchOnce().catch((e) => console.error("[mail] dispatch", e));
}
