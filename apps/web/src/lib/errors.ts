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
  UNAUTHENTICATED: "لازم تسجّل دخول الأول",
  FORBIDDEN: "مش مسموح لك تعمل الحركة دي",
  NOT_FOUND: "اللي بتدوّر عليه مش موجود",
  VALIDATION: "راجع البيانات اللي دخلتها",
  RATE_LIMITED: "محاولات كتير ورا بعض — استنى شوية وجرّب تاني",
  INVALID_CREDENTIALS: "البريد الإلكتروني أو كلمة السر مش صح",
  INVITE_INVALID: "رابط الدعوة ده مش صالح أو انتهت صلاحيته",
  CONFLICT: "البيانات اتغيرت من حد تاني — حدّث الصفحة وجرّب تاني",
  INTERNAL: "حصل خطأ غير متوقع — جرّب تاني بعد شوية",
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
