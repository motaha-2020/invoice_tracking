import "server-only";

/** إعدادات من البيئة (.env على السيرفر). مفيش أسرار هنا — بس قراءة. */
export const env = {
  /** الرابط العام للمنظومة — بيتحط في روابط الإيميلات (الدعوة، المستخلص) */
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
};
