import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/features/auth/session-cookie";

/**
 * Proxy (اسمه كان middleware قبل Next 16): فحص سريع من غير DB.
 * - مفيش كوكي جلسة ← تحويل لـ /login?next=...
 * - فيه كوكي ← بنجدد عمره (sliding 12 ساعة) مع كل تنقل GET.
 * التحقق الحقيقي (الجلسة في DB، الدور، النطاق) بيحصل في getCurrentUser وفي كل Server Action.
 */
const PUBLIC_PREFIXES = ["/login", "/invite/", "/api/health"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));

  if (!token) {
    if (isPublic) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  // POST = Server Actions (login/logout بيكتبوا الكوكي بنفسهم) — ما نلمسهاش
  if (request.method === "GET") res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}

export const config = {
  matcher: [
    // كل حاجة ما عدا ملفات Next الثابتة والصور والـ favicon وأي ملف بامتداد (public/)
    "/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
