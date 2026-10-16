/**
 * التقارير الدورية بالبريد — دوال صافية (التوقيت + نص الرسائل) عشان تتختبر.
 * - الملخص اليومي: لكل مسؤول عنده مستخلصات متأخرة بس (قرار التشغيل)، أيام العمل فقط، في الساعة المضبوطة في الإعدادات.
 * - التقرير الأسبوعي: لـ PMO ورؤساء القطاعات والمديرين العموم (قرار التشغيل)، في اليوم المضبوط في الإعدادات.
 */
import type { Kpis } from "@it/domain";

export type CairoNow = { date: string; time: string; weekday: "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat" };

export function cairoNow(d: Date = new Date()): CairoNow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    weekday: get("weekday").toLowerCase().slice(0, 3) as CairoNow["weekday"],
  };
}

/** وقت الإرسال جه، والنهارده ما اتبعتش قبل كده */
export function isDue(now: CairoNow, at: string, lastRun: string | null): boolean {
  return now.time >= at && lastRun !== now.date;
}

export type LateItem = { invoiceNo: string; company: string; step: string; elapsed: number; sla: number; url: string };

export function dailyDigestEmail(name: string, items: readonly LateItem[], inboxUrl: string): { subject: string; body: string } {
  const sorted = [...items].sort((a, b) => b.elapsed - b.sla - (a.elapsed - a.sla));
  const lines = sorted.map((i) => `• المستخلص رقم ${i.invoiceNo} (${i.company}) — ${i.step}: ${i.elapsed} يوم عمل من ${i.sla} (متجاوز بـ ${i.elapsed - i.sla})\n  ${i.url}`);
  return {
    subject: `ملخص يومي: ${items.length} مستخلص متجاوز للمدة المستهدفة لديكم — منظومة تتبع المستخلصات`,
    body: [
      `السيد/ ${name}`,
      "تحية طيبة، وبعد،",
      "",
      `نحيطكم علماً بوجود ${items.length} مستخلص لديكم تجاوز المدة المستهدفة (SLA)، ونرجو التكرم باتخاذ الإجراء:`,
      "",
      ...lines,
      "",
      `المهام الواردة: ${inboxUrl}`,
      "",
      "وتفضلوا بقبول فائق الاحترام،",
      "منظومة تتبع المستخلصات — المصرية للاتصالات",
    ].join("\n"),
  };
}

const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
const num = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });

export function weeklyReportEmail(
  name: string,
  scope: string,
  k: Kpis,
  extra: { late: number; stepNames: Record<string, string> },
  reportsUrl: string,
): { subject: string; body: string } {
  const worst = [...k.byStep].filter((s) => s.late > 0).sort((a, b) => b.late - a.late).slice(0, 3);
  return {
    subject: `التقرير الأسبوعي لمؤشرات المستخلصات — ${scope} — منظومة تتبع المستخلصات`,
    body: [
      `السيد/ ${name}`,
      "تحية طيبة، وبعد،",
      "",
      `نتشرف بموافاتكم بمؤشرات أداء مسار المستخلصات (${scope}):`,
      "",
      `• المستخلصات المقدمة: ${k.submitted} — المفتوحة: ${k.open} — المسددة: ${k.paid}`,
      `• المتجاوزة للمدة المستهدفة حالياً: ${extra.late}`,
      `• نسبة الالتزام بالمدة المستهدفة: ${pct(k.slaCompliance.pct)} (${k.slaCompliance.onTime} من ${k.slaCompliance.total} مرحلة)`,
      `• متوسط مدة الدورة: ${k.avgCycle == null ? "—" : `${k.avgCycle.toFixed(1)} يوم عمل`}`,
      `• نسبة الأيام لدى المقاول: ${pct(k.companySharePct)}`,
      `• نسبة الإعادة للاستيفاء: ${pct(k.returnRate.pct)}`,
      `• إجمالي الأعمال المعتمدة: ${num(k.grossSubmitted)} جنيه — منها مسدد ${num(k.grossPaid)} جنيه`,
      ...(worst.length ? ["", "أكثر المراحل تأخراً:", ...worst.map((s) => `• ${extra.stepNames[s.step] ?? s.step}: ${s.late} مرة تأخير، بمتوسط تجاوز ${s.avgOver.toFixed(1)} يوم`)] : []),
      ...(k.topReasons.length ? ["", `أكثر أسباب الإعادة: ${k.topReasons.slice(0, 3).map((r) => `${r.name} (${r.count})`).join("، ")}`] : []),
      "",
      `للتفاصيل والتصدير إلى Excel: ${reportsUrl}`,
      "",
      "وتفضلوا بقبول فائق الاحترام،",
      "منظومة تتبع المستخلصات — المصرية للاتصالات",
    ].join("\n"),
  };
}
