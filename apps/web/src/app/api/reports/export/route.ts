import { getCurrentUser } from "@/features/auth/session";
import { reportWorkbook } from "@/features/reports/reports.export";
import { parseFilter } from "@/features/reports/reports.filters";
import { assertReports, buildReport, describeFilter } from "@/features/reports/reports.service";
import { isAppError, toArabicMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";

/** تصدير التقرير لـ Excel بنفس فلاتر الشاشة (?company=…&sector=…) */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("يرجى تسجيل الدخول أولاً", { status: 401 });
  try {
    await assertReports(user, "reports.export");
    const filter = parseFilter(Object.fromEntries(new URL(request.url).searchParams));
    const [report, filterLines] = await Promise.all([buildReport(user, filter), describeFilter(user, filter)]);
    const data = await reportWorkbook(report, { filterLines, generatedBy: user.name, generatedAt: formatDateTime(new Date()) });
    const name = `تقرير_المستخلصات_${report.today}.xlsx`;
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (!isAppError(e)) console.error("[reports:export]", e);
    return new Response(toArabicMessage(e), { status: isAppError(e) && e.code === "FORBIDDEN" ? 403 : 500 });
  }
}
