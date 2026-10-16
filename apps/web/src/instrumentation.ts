/** بيشتغل مرة واحدة عند تشغيل السيرفر — مرسل البريد + جدولة التقارير الدورية (Node runtime بس) */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startDispatcher } = await import("./features/emails/dispatcher");
  startDispatcher();
  const { startDigestScheduler } = await import("./features/reports/digest.service");
  startDigestScheduler();
}
