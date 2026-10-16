import "server-only";
import ExcelJS from "exceljs";
import type { Report } from "./reports.service";

/**
 * ملف Excel للتقرير — بمعادلات حقيقية (مش أرقام ثابتة):
 *   «المستخلصات»   صف لكل مستخلص (البيانات الخام + أعمدة محسوبة بمعادلات)
 *   «المراحل»      صف لكل مرور منتهي بمرحلة اعتماد (الأيام والمدة المستهدفة والالتزام بمعادلات)
 *   «أسباب الإعادة» صف لكل سبب في كل إعادة
 *   «المؤشرات»     كل مؤشر = معادلة على الأوراق اللي فوق (COUNTIFS / SUMIFS / AVERAGEIFS)
 *   «شرح المعادلات» المعادلة ومعناها وإزاي تقراها
 * لو حد عدّل أو فلتر البيانات في Excel نفسه، المؤشرات بتتحسب من جديد.
 */

const BRAND = "FF5C2D91";
const HEAD_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
const SOFT_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF6F2FA" } };
const FONT = "Arial";

type Col = { header: string; key: string; width: number; fmt?: string };

function sheet(wb: ExcelJS.Workbook, name: string, cols: Col[]): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width, style: { font: { name: FONT, size: 10 }, numFmt: c.fmt } }));
  const h = ws.getRow(1);
  h.font = { name: FONT, bold: true, color: { argb: "FFFFFFFF" } };
  h.fill = HEAD_FILL;
  h.alignment = { vertical: "middle", wrapText: true };
  h.height = 30;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return ws;
}

const toDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

export type ExportMeta = { filterLines: string[]; generatedBy: string; generatedAt: string };

export async function reportWorkbook(report: Report, meta: ExportMeta): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "منظومة تتبع المستخلصات";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  // ── المستخلصات ──
  const inv = sheet(wb, "المستخلصات", [
    { header: "رقم المستخلص", key: "no", width: 13 },
    { header: "المقاول", key: "company", width: 18 },
    { header: "العقد", key: "contract", width: 16 },
    { header: "أمر التكليف", key: "ao", width: 12 },
    { header: "المشروع", key: "project", width: 26 },
    { header: "السنترال", key: "central", width: 18 },
    { header: "الإدارة المختصة", key: "dept", width: 20 },
    { header: "الإدارة العامة", key: "gdept", width: 24 },
    { header: "القطاع", key: "sector", width: 20 },
    { header: "رئاسة القطاعات", key: "presidency", width: 22 },
    { header: "نوع الأعمال", key: "workType", width: 14 },
    { header: "الفئة", key: "category", width: 8 },
    { header: "الحالة", key: "status", width: 15 },
    { header: "لدى", key: "holder", width: 18 },
    { header: "تاريخ التقديم", key: "submitted", width: 13, fmt: "dd/mm/yyyy" },
    { header: "تاريخ السداد", key: "paid", width: 13, fmt: "dd/mm/yyyy" },
    { header: "مدة الدورة (يوم عمل)", key: "cycle", width: 12 },
    { header: "أيام لدى المقاول", key: "companyDays", width: 12 },
    { header: "عدد مرات الإعادة", key: "returns", width: 11 },
    { header: "مراحل منتهية لها مدة", key: "stepsDone", width: 12 },
    { header: "مراحل انتهت في الميعاد", key: "stepsOnTime", width: 12 },
    { header: "القيمة المعتمدة", key: "gross", width: 16, fmt: "#,##0.00" },
    { header: "صافي المسدد", key: "paidAmount", width: 16, fmt: "#,##0.00" },
    { header: "مفتوح؟ (1 = لم يُسدَّد)", key: "open", width: 12 },
    { header: "نسبة الالتزام للمستخلص", key: "slaPct", width: 12, fmt: "0.0%" },
    { header: "نسبة أيام المقاول", key: "companyPct", width: 12, fmt: "0.0%" },
    { header: "حالة المدة المستهدفة الآن", key: "slaNow", width: 18 },
  ]);
  report.rows.forEach((r, i) => {
    const n = i + 2;
    inv.addRow({
      no: r.invoiceNo,
      company: r.company,
      contract: r.contractNo,
      ao: r.aoNo,
      project: r.project,
      central: r.central,
      dept: r.dept,
      gdept: r.generalDept,
      sector: r.sector,
      presidency: r.presidency,
      workType: r.workType,
      category: r.categoryFinal ? r.category : `${r.category} (مقترحة)`,
      status: r.statusLabel,
      holder: r.holder,
      submitted: toDate(r.submittedAt),
      paid: toDate(r.paidAt),
      cycle: r.metrics.cycle,
      companyDays: r.metrics.companyDays,
      returns: r.metrics.returns,
      stepsDone: r.metrics.stepsDone,
      stepsOnTime: r.metrics.stepsOnTime,
      gross: r.gross,
      paidAmount: r.paidAmount,
      open: { formula: `IF(M${n}="تم السداد",0,1)`, result: r.status === "paid" ? 0 : 1 },
      slaPct: { formula: `IF(T${n}>0,U${n}/T${n},"")`, result: r.metrics.stepsDone ? r.metrics.stepsOnTime / r.metrics.stepsDone : "" },
      companyPct: { formula: `IF(Q${n}>0,R${n}/Q${n},"")`, result: r.metrics.cycle ? r.metrics.companyDays / r.metrics.cycle : "" },
      slaNow: r.sla.label,
    });
  });
  const last = Math.max(2, report.rows.length + 1);
  const total = inv.addRow({ no: "الإجمالي", gross: { formula: `SUM(V2:V${last})` }, paidAmount: { formula: `SUM(W2:W${last})` }, open: { formula: `SUM(X2:X${last})` } });
  total.font = { name: FONT, bold: true };
  total.fill = SOFT_FILL;

  // ── المراحل ──
  const seg = sheet(wb, "المراحل", [
    { header: "رقم المستخلص", key: "no", width: 13 },
    { header: "المرحلة", key: "step", width: 22 },
    { header: "الأيام (عمل)", key: "days", width: 11 },
    { header: "المدة المستهدفة", key: "sla", width: 12 },
    { header: "في الميعاد؟ (1/0)", key: "onTime", width: 12 },
    { header: "أيام التجاوز", key: "over", width: 11 },
  ]);
  let segN = 1;
  for (const r of report.rows) {
    for (const s of r.metrics.segments) {
      if (s.open || s.step === "company") continue;
      segN++;
      seg.addRow({
        no: r.invoiceNo,
        step: report.steps[s.step] ?? s.step,
        days: s.days,
        sla: s.sla,
        onTime: { formula: `IF(D${segN}="","",IF(C${segN}<=D${segN},1,0))`, result: s.sla == null ? "" : s.days <= s.sla ? 1 : 0 },
        over: { formula: `IF(D${segN}="","",MAX(0,C${segN}-D${segN}))`, result: s.sla == null ? "" : Math.max(0, s.days - s.sla) },
      });
    }
  }
  const segLast = Math.max(2, segN);

  // ── أسباب الإعادة ──
  const rs = sheet(wb, "أسباب الإعادة", [
    { header: "رقم المستخلص", key: "no", width: 13 },
    { header: "السبب", key: "reason", width: 50 },
  ]);
  let rsN = 1;
  for (const r of report.rows) for (const reason of r.reasons) {
    rs.addRow({ no: r.invoiceNo, reason });
    rsN++;
  }
  const rsLast = Math.max(2, rsN);

  // ── المؤشرات ──
  const k = report.kpis;
  const ws = wb.addWorksheet("المؤشرات", { views: [{ rightToLeft: true }] });
  ws.columns = [{ width: 40 }, { width: 22 }, { width: 70 }];
  const title = ws.addRow(["مؤشرات أداء مسار المستخلصات"]);
  title.font = { name: FONT, bold: true, size: 15, color: { argb: BRAND } };
  ws.addRow([`أُعد بواسطة: ${meta.generatedBy} — ${meta.generatedAt}`]).font = { name: FONT, size: 9, color: { argb: "FF71717F" } };
  ws.addRow([`الفلتر: ${meta.filterLines.length ? meta.filterLines.join(" · ") : "جميع المستخلصات ضمن نطاق الصلاحية"}`]).font = { name: FONT, size: 9, color: { argb: "FF71717F" } };
  ws.addRow([]);

  const D = (col: string) => `'المستخلصات'!${col}2:${col}${last}`;
  const S = (col: string) => `'المراحل'!${col}2:${col}${segLast}`;
  const R = (col: string) => `'أسباب الإعادة'!${col}2:${col}${rsLast}`;
  const PAID = `"تم السداد"`;
  const header = (cells: string[]) => {
    const row = ws.addRow(cells);
    row.font = { name: FONT, bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = HEAD_FILL;
  };
  const kpi = (label: string, formula: string, result: number | string | null, fmt: string, meaning: string) => {
    const row = ws.addRow([label, { formula, result: result ?? "" }, meaning]);
    row.getCell(2).numFmt = fmt;
    row.getCell(2).font = { name: FONT, bold: true, size: 12 };
    row.font = { name: FONT, size: 10 };
    row.getCell(3).alignment = { wrapText: true, vertical: "top" };
  };

  header(["المؤشر", "القيمة", "المعنى"]);
  kpi("عدد المستخلصات المقدمة", `COUNTA(${D("A")})`, k.submitted, "0", "كل المستخلصات المطابقة للفلتر (المسودات مستبعدة).");
  kpi("المستخلصات المفتوحة", `SUM(${D("X")})`, k.open, "0", "قيد المراجعة + معاد للاستيفاء + موقوف — حجم العمل الجاري في المسار.");
  kpi("المتجاوزة للمدة المستهدفة الآن", `COUNTIF(${D("AA")},"متجاوز للمدة")`, report.rows.filter((r) => r.sla.k === "late").length, "0", "مستخلصات قيد المراجعة تجاوزت مدتها المستهدفة في مرحلتها الحالية — أولوية المتابعة اليوم.");
  kpi("المستخلصات المسددة", `COUNTIF(${D("M")},${PAID})`, k.paid, "0", "اكتمل مسارها وسُددت.");
  kpi("نسبة الالتزام بالمدة المستهدفة", `IFERROR(SUM(${D("U")})/SUM(${D("T")}),"")`, k.slaCompliance.pct == null ? null : k.slaCompliance.pct / 100, "0.0%", "مراحل انتهت في حدود مدتها ÷ كل المراحل المنتهية اللي ليها مدة. 90% فأكثر ممتاز، أقل من 70% يحتاج تدخل.");
  kpi(
    "متوسط مدة الدورة (يوم عمل)",
    `IF(COUNTIF(${D("M")},${PAID})>0,AVERAGEIFS(${D("Q")},${D("M")},${PAID}),IFERROR(AVERAGE(${D("Q")}),""))`,
    k.avgCycle,
    "0.0",
    "متوسط أيام العمل من أول تقديم حتى السداد (المسدد فقط؛ ولو مفيش مسدد: حتى اليوم لكل المقدم).",
  );
  kpi(
    "نسبة الأيام لدى المقاول",
    `IF(COUNTIF(${D("M")},${PAID})>0,IFERROR(SUMIFS(${D("R")},${D("M")},${PAID})/SUMIFS(${D("Q")},${D("M")},${PAID}),""),IFERROR(SUM(${D("R")})/SUM(${D("Q")}),""))`,
    k.companySharePct == null ? null : k.companySharePct / 100,
    "0.0%",
    "من مدة الدورة: الأيام اللي قضاها المستخلص لدى المقاول بعد إعادته للاستيفاء. لو عالية، التأخير من جهة المقاول.",
  );
  kpi("نسبة الإعادة للاستيفاء", `IFERROR(COUNTIF(${D("S")},">0")/COUNTA(${D("A")}),"")`, k.returnRate.pct == null ? null : k.returnRate.pct / 100, "0.0%", "مستخلصات أُعيدت مرة أو أكثر ÷ المقدمة. حتى 20% جيد، أكثر من 40% يدل على مشكلة متكررة في جودة التقديم.");
  kpi("إجمالي الأعمال المعتمدة (جنيه)", `SUM(${D("V")})`, k.grossSubmitted, "#,##0", "مجموع القيمة المعتمدة (الكمية المعتمدة × سعر العقد) للمستخلصات المقدمة.");
  kpi("منها المسدد (جنيه)", `SUMIFS(${D("V")},${D("M")},${PAID})`, k.grossPaid, "#,##0", "القيمة المعتمدة للمستخلصات المسددة.");
  kpi("صافي المبالغ المسددة (جنيه)", `SUM(${D("W")})`, report.rows.reduce((a, r) => a + (r.paidAmount ?? 0), 0), "#,##0", "صافي الشيكات / التحويلات (بعد المحتجز والضريبة والاستقطاعات).");
  ws.addRow([]);

  header(["مرحلة الاعتماد", "مرات المرور", "متوسط الأيام / متأخر / متوسط التجاوز"]);
  for (const s of k.byStep) {
    const name = report.steps[s.step] ?? s.step;
    const q = `"${name.replace(/"/g, '""')}"`;
    const row = ws.addRow([
      name,
      { formula: `COUNTIF(${S("B")},${q})`, result: s.count },
      {
        formula: `TEXT(IFERROR(AVERAGEIF(${S("B")},${q},${S("C")}),0),"0.0")&" يوم · متأخر "&COUNTIFS(${S("B")},${q},${S("E")},0)&" · تجاوز "&TEXT(IFERROR(AVERAGEIFS(${S("F")},${S("B")},${q},${S("E")},0),0),"0.0")&" يوم"`,
        result: `${s.avgDays.toFixed(1)} يوم · متأخر ${s.late} · تجاوز ${s.avgOver.toFixed(1)} يوم`,
      },
    ]);
    row.font = { name: FONT, size: 10 };
  }
  ws.addRow([]);

  header(["سبب الإعادة", "عدد المرات", ""]);
  for (const r of k.topReasons) {
    const q = `"${r.name.replace(/"/g, '""')}"`;
    ws.addRow([r.name, { formula: `COUNTIF(${R("B")},${q})`, result: r.count }]).font = { name: FONT, size: 10 };
  }
  ws.addRow([]);

  header(["المقاول", "عدد المستخلصات", "الأعمال المعتمدة (جنيه)"]);
  for (const c of report.byCompany) {
    const q = `"${c.company.replace(/"/g, '""')}"`;
    const row = ws.addRow([c.company, { formula: `COUNTIF(${D("B")},${q})`, result: c.count }, { formula: `SUMIF(${D("B")},${q},${D("V")})`, result: c.gross }]);
    row.getCell(3).numFmt = "#,##0";
    row.font = { name: FONT, size: 10 };
  }

  // ── شرح المعادلات ──
  const ex = sheet(wb, "شرح المعادلات", [
    { header: "المؤشر", key: "k", width: 30 },
    { header: "المعادلة في Excel", key: "f", width: 60 },
    { header: "معناه", key: "m", width: 55 },
    { header: "إزاي تقراه", key: "r", width: 55 },
  ]);
  const EXPLAIN: [string, string, string, string][] = [
    ["المتجاوزة للمدة المستهدفة الآن", "=COUNTIF(المستخلصات!AA:AA, \"متجاوز للمدة\")", "مستخلصات قيد المراجعة عدّت مدة مرحلتها الحالية (نفس حساب المهام الواردة).", "دي اللي محتاجة متابعة النهارده — ويوصل بيها ملخص يومي للمسؤول عنها."],
    ["المستخلصات المفتوحة", "=SUM(المستخلصات!X:X) — حيث X =IF(الحالة=\"تم السداد\",0,1)", "عدد المستخلصات اللي لسه في المسار.", "زيادته من أسبوع لأسبوع = الوارد أكتر من المنجز."],
    ["نسبة الالتزام بالمدة المستهدفة", "=SUM(U)/SUM(T) — U مراحل في الميعاد، T مراحل منتهية لها مدة", "كل مرة مستخلص يعدّي مرحلة: هل خلصت في المدة المحددة لفئته (SLA)؟", "≥ 90% ممتاز · 70–90% مقبول · < 70% يحتاج تدخل (راجع ورقة «المراحل» لمعرفة المرحلة المتأخرة)."],
    ["متوسط مدة الدورة", "=AVERAGEIFS(Q, M, \"تم السداد\")", "متوسط أيام العمل من أول تقديم لحد السداد.", "قارنه بإجمالي المدة المستهدفة للفئة (C1 = 10 يوم مثلاً)."],
    ["نسبة الأيام لدى المقاول", "=SUMIFS(R, M, \"تم السداد\") / SUMIFS(Q, M, \"تم السداد\")", "جزء الدورة اللي كان المستخلص فيه عند المقاول بعد الإعادة.", "لو أكثر من 30%: التأخير غالباً من استيفاء المقاول وليس من الإدارات."],
    ["نسبة الإعادة للاستيفاء", "=COUNTIF(S, \">0\") / COUNTA(A)", "نسبة المستخلصات اللي اتعادت مرة على الأقل.", "≤ 20% جيد · > 40% مشكلة متكررة — راجع «أسباب الإعادة»."],
    ["في الميعاد؟ (ورقة المراحل)", "=IF(D=\"\",\"\",IF(C<=D,1,0))", "C = أيام المرحلة، D = مدتها المستهدفة.", "1 في الميعاد، 0 متأخر، فاضي = المرحلة مالهاش مدة مستهدفة."],
    ["أيام التجاوز", "=IF(D=\"\",\"\",MAX(0,C-D))", "كام يوم المرحلة عدّت مدتها.", "متوسطه لكل مرحلة في «المؤشرات» = حجم عنق الزجاجة."],
    ["عدد مرات المرور بالمرحلة", "=COUNTIF(المراحل!B:B, \"اسم المرحلة\")", "كل مرور منتهي (الإعادة والاستئناف بيعملوا مرور جديد).", "المرحلة الأكبر متوسط أيام والأكثر تأخراً هي الأولى بالمتابعة."],
    ["الأعمال المعتمدة", "=SUM(V) و =SUMIF(B, \"المقاول\", V)", "الكمية المعتمدة × سعر العقد (قبل المحتجز والضريبة).", "قارن المسدد بالمعتمد لمعرفة المتأخر في الصرف."],
    ["أيام العمل", "—", "بعد استبعاد الجمعة والسبت والعطلات الرسمية المسجلة في المنظومة.", "يوم التقديم نفسه لا يُحتسب."],
  ];
  for (const [kk, f, m, r] of EXPLAIN) {
    const row = ex.addRow({ k: kk, f, m, r });
    row.alignment = { wrapText: true, vertical: "top" };
  }

  // المؤشرات أول ورقة تظهر
  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 3, visibility: "visible" }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
