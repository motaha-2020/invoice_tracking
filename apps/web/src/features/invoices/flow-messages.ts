/**
 * نصوص الإشعارات والبريد الإلكتروني لحركات المستخلص — دوال صافية (تتختبر بـ vitest).
 * اللغة: العربية الفصحى الرسمية حسب docs/glossary.md.
 */

export type MessageKind =
  | "submitted"
  | "approved"
  | "returned_company"
  | "returned_step"
  | "resubmitted"
  | "held"
  | "released"
  | "paid";

export type MessageContext = {
  kind: MessageKind;
  invoiceNo: string;
  companyName: string;
  aoNo: string;
  pathName: string;
  /** اسم المرحلة اللي المستخلص وصل لها / الجهة المعنية */
  stepName?: string;
  /** الجهة اللي اتخذت الإجراء */
  fromName?: string;
  note?: string | null;
  reasons?: readonly string[];
  /** رقم الشيك / التحويل وقيمته (للسداد) */
  paymentRef?: string;
  amount?: string;
  url: string;
};

export function notificationTitle(c: MessageContext): string {
  const no = `المستخلص رقم ${c.invoiceNo} (${c.companyName})`;
  switch (c.kind) {
    case "submitted":
      return `ورد إليك ${no} للمراجعة — ${c.stepName ?? ""}`.trim();
    case "approved":
      return `أُحيل إليك ${no} بعد اعتماده من ${c.fromName ?? "المرحلة السابقة"}`;
    case "returned_company":
      return `أُعيد ${no} للاستيفاء من ${c.fromName ?? ""}`.trim();
    case "returned_step":
      return `أُعيد إليك ${no} للاستيفاء من ${c.fromName ?? ""}`.trim();
    case "resubmitted":
      return `أُعيد تقديم ${no} بعد استيفاء الملاحظات`;
    case "held":
      return `أُوقف ${no} مؤقتاً`;
    case "released":
      return `استُؤنفت مراجعة ${no}`;
    case "paid":
      return `تم سداد ${no}`;
  }
}

function headline(c: MessageContext): string {
  switch (c.kind) {
    case "submitted":
      return `نحيطكم علماً بورود المستخلص المبين أدناه إلى مرحلة «${c.stepName}» للمراجعة واتخاذ الإجراء.`;
    case "approved":
      return `نحيطكم علماً بأن المستخلص المبين أدناه قد اعتُمد من ${c.fromName} وأُحيل إلى مرحلة «${c.stepName}» لاتخاذ الإجراء.`;
    case "returned_company":
      return `نحيطكم علماً بأن المستخلص المبين أدناه قد أُعيد إليكم للاستيفاء من ${c.fromName}، يرجى استيفاء الملاحظات وإعادة التقديم.`;
    case "returned_step":
      return `نحيطكم علماً بأن المستخلص المبين أدناه قد أُعيد إليكم للاستيفاء من ${c.fromName}.`;
    case "resubmitted":
      return `نحيطكم علماً بأن المستخلص المبين أدناه قد أُعيد تقديمه بعد استيفاء الملاحظات، وهو الآن في مرحلة «${c.stepName}».`;
    case "held":
      return "نحيطكم علماً بأن المستخلص المبين أدناه قد أُوقف مؤقتاً، ويتوقف احتساب المدة المستهدفة حتى الاستئناف.";
    case "released":
      return `نحيطكم علماً باستئناف مراجعة المستخلص المبين أدناه في مرحلة «${c.stepName}».`;
    case "paid":
      return "نحيطكم علماً بأنه تم سداد المستخلص المبين أدناه.";
  }
}

export function emailSubject(c: MessageContext): string {
  return `${notificationTitle(c)} — منظومة تتبع المستخلصات`;
}

export function emailBody(c: MessageContext, toName: string): string {
  const lines = [
    `السيد/ ${toName}`,
    "تحية طيبة، وبعد،",
    "",
    headline(c),
    "",
    `رقم المستخلص: ${c.invoiceNo}`,
    `المقاول: ${c.companyName}`,
    `أمر التكليف: ${c.aoNo}`,
    `اسم المسار: ${c.pathName}`,
  ];
  if (c.paymentRef) lines.push(`رقم الشيك / التحويل البنكي: ${c.paymentRef}`);
  if (c.amount) lines.push(`المبلغ: ${c.amount} جنيه`);
  if (c.reasons?.length) lines.push(`أسباب الإعادة: ${c.reasons.join("، ")}`);
  if (c.note) lines.push("", "الملاحظات:", c.note);
  lines.push("", `للاطلاع على المستخلص: ${c.url}`, "", "وتفضلوا بقبول فائق الاحترام،", "منظومة تتبع المستخلصات — المصرية للاتصالات");
  return lines.join("\n");
}
