/**
 * rate limit بسيط في الذاكرة (fixed window). كفاية لسيرفر واحد؛ لو بقى فيه أكتر من instance
 * يتنقل لـ Postgres أو Redis.
 */
type Bucket = { count: number; resetAt: number };

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** هل المفتاح ده لسه مسموح له؟ (من غير ما يسجّل محاولة) */
  isBlocked(key: string): boolean {
    const b = this.current(key);
    return b !== null && b.count >= this.limit;
  }

  /** سجّل محاولة فاشلة */
  hit(key: string): void {
    const b = this.current(key);
    if (b) b.count += 1;
    else this.buckets.set(key, { count: 1, resetAt: this.now() + this.windowMs });
    if (this.buckets.size > 10_000) this.sweep();
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  private current(key: string): Bucket | null {
    const b = this.buckets.get(key);
    if (!b) return null;
    if (b.resetAt <= this.now()) {
      this.buckets.delete(key);
      return null;
    }
    return b;
  }

  private sweep(): void {
    const t = this.now();
    for (const [k, b] of this.buckets) if (b.resetAt <= t) this.buckets.delete(k);
  }
}

// نفس الـ instance عبر الـ HMR في dev
const g = globalThis as unknown as { __loginLimits?: { email: RateLimiter; ip: RateLimiter } };

/** 5 محاولات غلط لكل إيميل و 20 لكل IP في 15 دقيقة */
export const loginLimits = (g.__loginLimits ??= {
  email: new RateLimiter(5, 15 * 60 * 1000),
  ip: new RateLimiter(20, 15 * 60 * 1000),
});
