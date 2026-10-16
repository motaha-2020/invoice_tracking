/** بيشتغل مرة واحدة عند تشغيل السيرفر — بيشغّل مرسل البريد (Node runtime بس) */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startDispatcher } = await import("./features/emails/dispatcher");
  startDispatcher();
}
