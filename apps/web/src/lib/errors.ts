/**
 * خطأ متوقع في المنظومة: code ثابت للكود واللوج، و messageAr للمستخدم.
 * في الـ Server Actions بنرجّعه كـ state (مش throw) عشان Next بيخفي رسايل الأخطاء في الـ production.
 */
export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "INVALID_CREDENTIALS"
  | "INVITE_INVALID"
  | "CONFLICT"
  | "INTERNAL";

const DEFAULT_MESSAGES: Record<AppErrorCode, string> = {
  UNAUTHENTICATED: "يرجى تسجيل الدخول أولاً",
  FORBIDDEN: "لا تملك صلاحية تنفيذ هذا الإجراء",
  NOT_FOUND: "البيانات المطلوبة غير موجودة",
  VALIDATION: "يرجى مراجعة البيانات المُدخلة",
  RATE_LIMITED: "تم تجاوز عدد المحاولات المسموح — يرجى الانتظار قليلاً ثم إعادة المحاولة",
  INVALID_CREDENTIALS: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
  INVITE_INVALID: "رابط الدعوة غير صالح أو انتهت صلاحيته",
  CONFLICT: "عُدِّلت البيانات من قِبل مستخدم آخر — يرجى تحديث الصفحة وإعادة المحاولة",
  INTERNAL: "حدث خطأ غير متوقع — يرجى إعادة المحاولة لاحقاً",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly messageAr: string;

  constructor(code: AppErrorCode, messageAr?: string, options?: { cause?: unknown }) {
    const msg = messageAr ?? DEFAULT_MESSAGES[code];
    super(msg, options);
    this.name = "AppError";
    this.code = code;
    this.messageAr = msg;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/** الرسالة العربي لأي خطأ — الأخطاء غير المتوقعة بتطلع برسالة عامة */
export function toArabicMessage(e: unknown): string {
  return isAppError(e) ? e.messageAr : DEFAULT_MESSAGES.INTERNAL;
}

/** شكل نتيجة الـ Server Action اللي بترجع للفورم */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** قيم ترجع للفورم بعد الخطأ (React بيعمل reset للفورم بعد الـ action) — ممنوع كلمات السر */
  values?: Record<string, string>;
};
