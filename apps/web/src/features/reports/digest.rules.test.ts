import { computeKpis, DEFAULT_WORKFLOW } from "@it/domain";
import { describe, expect, it } from "vitest";
import { cairoNow, dailyDigestEmail, isDue, weeklyReportEmail } from "./digest.rules";

describe("digest timing", () => {
  it("reads Cairo wall time", () => {
    // 2026-10-18 06:30Z = 09:30 بتوقيت القاهرة (UTC+3 صيفي) — الأحد
    const n = cairoNow(new Date("2026-10-18T06:30:00Z"));
    expect(n.date).toBe("2026-10-18");
    expect(n.weekday).toBe("sun");
    expect(n.time >= "08:00").toBe(true);
  });
  it("is due once per day after the configured time", () => {
    const now = { date: "2026-10-18", time: "08:05", weekday: "sun" as const };
    expect(isDue(now, "08:00", null)).toBe(true);
    expect(isDue(now, "08:00", "2026-10-18")).toBe(false);
    expect(isDue({ ...now, time: "07:59" }, "08:00", "2026-10-17")).toBe(false);
  });
});

describe("digest messages", () => {
  it("lists late invoices, most overdue first", () => {
    const m = dailyDigestEmail("أحمد", [
      { invoiceNo: "1", company: "النيل", step: "المدير العام", elapsed: 3, sla: 1, url: "u1" },
      { invoiceNo: "2", company: "الدلتا", step: "المدير العام", elapsed: 9, sla: 1, url: "u2" },
    ], "https://x/inbox");
    expect(m.subject).toContain("2 مستخلص");
    expect(m.body.indexOf("رقم 2")).toBeLessThan(m.body.indexOf("رقم 1"));
    expect(m.body).toContain("متجاوز بـ 8");
  });
  it("summarises KPIs for the weekly report", () => {
    const k = computeKpis([], { config: DEFAULT_WORKFLOW, holidays: [], today: "2026-10-18" });
    const m = weeklyReportEmail("رئيس القطاع", "قطاع الدقهلية", k, { late: 0, stepNames: {} }, "https://x/reports");
    expect(m.subject).toContain("قطاع الدقهلية");
    expect(m.body).toContain("نسبة الالتزام بالمدة المستهدفة: —");
    expect(m.body).toContain("https://x/reports");
  });
});
