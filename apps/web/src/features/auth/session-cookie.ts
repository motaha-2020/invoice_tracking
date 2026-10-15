/**
 * ثوابت كوكي الجلسة — مشتركة بين session.ts و proxy.ts
 * (من غير server-only ولا next/headers عشان الـ proxy يقدر يستوردها).
 */
export const SESSION_COOKIE = "it_session";

/** 12 ساعة sliding: كل request بيمد الصلاحية */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

/** secure افتراضياً في الـ production؛ COOKIE_SECURE=false لو السيرفر لسه على http */
function cookieSecure(): boolean {
  const v = process.env.COOKIE_SECURE;
  return v ? v === "true" : process.env.NODE_ENV === "production";
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
