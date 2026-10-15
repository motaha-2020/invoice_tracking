/** أكواد أخطاء قواعد الأعمال — الواجهة بتعرض `messageAr`، والكود للـ logs والاختبارات. */
export type DomainErrorCode =
  | 'INVALID_DATE'
  | 'INVALID_NUMBER'
  | 'INVALID_STATE'
  | 'UNKNOWN_STEP'
  | 'UNKNOWN_CATEGORY'
  | 'CATEGORY_REQUIRED'
  | 'STEP_NOT_IN_PATH'
  | 'INVALID_RETURN_TARGET'
  | 'REASON_REQUIRED'
  | 'NOTE_REQUIRED'
  | 'REF_REQUIRED'
  | 'PAY_REQUIRED'
  | 'NOT_LAST_STEP'
  | 'TERMS_PCT_SUM';

/** خطأ في قاعدة عمل. الـ service بيحوّله لـ AppError بنفس الكود والرسالة. */
export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly messageAr: string;

  constructor(code: DomainErrorCode, messageAr: string) {
    super(`${code}: ${messageAr}`);
    this.name = 'DomainError';
    this.code = code;
    this.messageAr = messageAr;
  }
}

/** هل الخطأ ده DomainError؟ (أأمن من instanceof عبر الحزم) */
export function isDomainError(e: unknown): e is DomainError {
  return e instanceof Error && e.name === 'DomainError' && 'code' in e && 'messageAr' in e;
}
