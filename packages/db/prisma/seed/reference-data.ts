// البيانات المرجعية الثابتة (من الديمو ديمو/js/data.js + شروط العقود في docs/data-dictionary.md)
// مفيهاش أي بيانات حقيقية لشركة أو عقد — دي إعدادات المسار والقوائم بس.
import type { Role } from '../../src/index';

export const WORKFLOW_STEPS: { key: string; name: string; short: string; role: Role }[] = [
  { key: 'company', name: 'المقاول', short: 'المقاول', role: 'company' },
  { key: 'sup', name: 'مراجعة مشرف التنفيذ', short: 'مشرف التنفيذ', role: 'supervisor' },
  { key: 'exec', name: 'مراجعة واعتماد مدير التنفيذ', short: 'إدارة التنفيذ', role: 'exec_mgr' },
  { key: 'gm', name: 'مراجعة واعتماد المدير العام', short: 'المدير العام', role: 'gm' },
  { key: 'tech', name: 'المراجعة الفنية — الشئون الفنية', short: 'الشئون الفنية', role: 'tech_affairs' },
  { key: 'plan', name: 'مراجعة التخطيط', short: 'التخطيط', role: 'planning' },
  { key: 'pres', name: 'موافقة رئاسة القطاعات', short: 'رئاسة القطاعات', role: 'presidency_head' },
  { key: 'committee', name: 'اللجنة العليا', short: 'اللجنة العليا', role: 'committee' },
  { key: 'pricing', name: 'تسعير البند المستجد', short: 'التسعير', role: 'planning' },
  { key: 'sector', name: 'اعتماد رئيس القطاع', short: 'رئيس القطاع', role: 'sector_head' },
  { key: 'stores', name: 'مراجعة المخازن والمشتريات', short: 'المخازن والمشتريات', role: 'stores' },
  { key: 'finance', name: 'السداد — الإدارة المالية', short: 'الإدارة المالية', role: 'finance' },
];

/** المسار لكل فئة: [محطة، SLA بأيام العمل] — null = من غير SLA (مشرف التنفيذ) */
export const CATEGORIES: { code: string; name: string; path: [string, number | null][] }[] = [
  { code: 'C1', name: 'لا يوجد تجاوز في البنود أو في إجمالي أمر التكليف',
    path: [['sup', null], ['exec', 2], ['gm', 1], ['tech', 2], ['stores', 2], ['finance', 3]] },
  { code: 'C2', name: 'تجاوز في بند أو أكثر دون تجاوز إجمالي أمر التكليف',
    path: [['sup', null], ['exec', 1], ['gm', 1], ['tech', 4], ['plan', 3], ['stores', 2], ['finance', 3]] },
  { code: 'C3', name: 'تجاوز إجمالي أمر التكليف بنسبة لا تزيد على 25%',
    path: [['sup', null], ['exec', 1], ['gm', 1], ['tech', 4], ['plan', 3], ['sector', 1], ['stores', 2], ['finance', 3]] },
  { code: 'C4', name: 'تجاوز إجمالي أمر التكليف بنسبة تزيد على 25%',
    path: [['sup', null], ['exec', 1], ['gm', 1], ['tech', 4], ['plan', 3], ['pres', 1], ['committee', 7], ['sector', 1], ['stores', 2], ['finance', 3]] },
  { code: 'C5', name: 'بند مستجد غير مُسعّر في التعاقد',
    path: [['sup', null], ['exec', 1], ['gm', 1], ['tech', 4], ['plan', 3], ['pricing', 10], ['pres', 1], ['committee', 7], ['sector', 1], ['stores', 2], ['finance', 3]] },
];

export const DOC_TYPES: { code: string; name: string }[] = [
  // مستندات التقديم (الديمو)
  { code: 'signed_invoice', name: 'نسخة المستخلص الورقي الموقّعة' },
  { code: 'joint_survey', name: 'محضر الحصر المشترك' },
  { code: 'site_photos', name: 'صور الموقع' },
  { code: 'test_report', name: 'محضر الاختبارات والقياسات' },
  { code: 'prelim_handover_cert', name: 'شهادة الاستلام الابتدائي' },
  { code: 'warranty_cert', name: 'شهادة الضمان' },
  { code: 'asbuilt_drawings', name: 'رسومات ما بعد التنفيذ (As-Built)' },
  { code: 'stores_return_ack', name: 'إقرار المخازن باستلام المهمات المُعادة' },
  { code: 'overrun_memo', name: 'مذكرة التجاوز' },
  // مستندات المالية (من شروط أوامر التكليف وجدول الصرف)
  { code: 'social_insurance_clearance', name: 'شهادة تسوية موقف التأمينات الاجتماعية' },
  { code: 'irregular_labor_payment', name: 'ما يفيد سداد نسبة العمالة غير المنتظمة' },
  { code: 'final_guarantee_letter', name: 'خطاب الضمان النهائي' },
  { code: 'asbuilt_maps', name: 'خرائط ما بعد التنفيذ (As-Built)' },
  { code: 'prelim_handover_report', name: 'محضر الاستلام الابتدائي' },
];

/** أنواع المشروعات (الـ Admin يقدر يضيف غيرها) — لازمة عشان المستندات الإلزامية */
export const PROJECT_TYPES: { code: string; name: string }[] = [
  { code: 'FIBERIZATION', name: 'Fiberization' },
  { code: 'USO', name: 'خدمة شاملة' },
  { code: 'FTTS', name: 'FTTS' },
  { code: 'ACCESS', name: 'إتاحة' },
  { code: 'CLOSED_COMPOUND', name: 'Closed Compound' },
];

/** أكواد اتزرعت في نسخ قديمة — بتتشال بس لو مالهاش مشروعات */
export const LEGACY_PROJECT_TYPES: string[] = ['FTTH', 'MSAN', 'FIBER', 'CIVIL'];

/** المستندات الإلزامية عند التقديم (نفس القائمة لكل نوع — الـ Admin يعدّلها من شاشة المسار) */
export const REQUIRED_SUBMIT_DOCS: string[] = [
  'signed_invoice', 'joint_survey', 'site_photos', 'test_report', 'asbuilt_drawings',
];

/** أنواع الأعمال في المستخلص — isPlanning = بيتصرف 100% بعد الانتهاء من غير محجوز */
export const WORK_TYPES: { code: string; name: string; isPlanning?: true }[] = [
  { code: 'CIVIL', name: 'أعمال مدنية' },
  { code: 'CIVIL_MAINT', name: 'صيانة مدني' },
  { code: 'ELECTRICAL', name: 'أعمال كهربية' },
  { code: 'INTEGRATED', name: 'أعمال متكاملة' },
  { code: 'PLANNING', name: 'تخطيط ورسومات', isPlanning: true },
];

/** المستندات الإلزامية قبل الصرف (كل الأنواع) */
export const REQUIRED_FINANCE_DOCS: string[] = [
  'social_insurance_clearance',
  'irregular_labor_payment',
  'final_guarantee_letter',
  'asbuilt_maps',
  'prelim_handover_report',
];

/** id ثابت عشان الـ seed يبقى idempotent (الجدول مالوش كود) */
export const RETURN_REASONS: { id: string; name: string }[] = [
  { id: 'rr1', name: 'توقيع أو ختم ناقص' },
  { id: 'rr2', name: 'مستند مطلوب غير مرفق' },
  { id: 'rr3', name: 'الكميات غير مطابقة للحصر' },
  { id: 'rr4', name: 'تجاوز غير مبرر عن أمر التكليف' },
  { id: 'rr5', name: 'المهمات غير مطابقة للمنصرف من المخازن' },
  { id: 'rr6', name: 'خطأ في الحسابات أو الأسعار' },
  { id: 'rr7', name: 'اختلاف في بيانات العقد أو أمر التكليف' },
  { id: 'rr8', name: 'صور أو رسومات غير واضحة' },
  { id: 'rr9', name: 'أخرى (موضّحة في الملاحظات)' },
];

/** الأجازات الرسمية 2026 (نفس تواريخ الديمو) */
export const HOLIDAYS_2026: { date: string; name: string }[] = [
  { date: '2026-01-07', name: 'عيد الميلاد المجيد' },
  { date: '2026-01-25', name: 'عيد الشرطة وثورة 25 يناير' },
  { date: '2026-04-12', name: 'عيد القيامة المجيد' },
  { date: '2026-04-13', name: 'شم النسيم' },
  { date: '2026-04-25', name: 'عيد تحرير سيناء' },
  { date: '2026-05-01', name: 'عيد العمال' },
  { date: '2026-05-26', name: 'وقفة عرفات' },
  { date: '2026-05-27', name: 'عيد الأضحى' },
  { date: '2026-05-28', name: 'عيد الأضحى (اليوم الثاني)' },
  { date: '2026-06-16', name: 'رأس السنة الهجرية' },
  { date: '2026-06-30', name: 'ذكرى ثورة 30 يونيو' },
  { date: '2026-07-23', name: 'عيد ثورة 23 يوليو' },
  { date: '2026-08-25', name: 'المولد النبوي الشريف' },
  { date: '2026-10-06', name: 'عيد القوات المسلحة' },
];

/** صلاحيات إضافية لكل دور (غير الاعتماد في محطته) */
export const PERMISSIONS: Record<string, Role[]> = {
  'invoice.create': ['company'],
  'invoice.viewAll': ['admin', 'pmo'],
  'invoice.override': ['admin', 'pmo'],
  'master.import': ['admin', 'tech_affairs'],
  'org.manage': ['admin', 'pmo', 'tech_affairs'],
  'issues.import': ['admin', 'stores'],
  'users.manage': ['admin'],
  'workflow.config': ['admin', 'pmo'],
  'reports.view': ['admin', 'pmo', 'exec_mgr', 'gm', 'tech_affairs', 'tech_office', 'planning',
    'sector_head', 'presidency_head', 'stores', 'finance', 'company'],
  'reports.export': ['admin', 'pmo', 'gm', 'tech_affairs', 'sector_head', 'presidency_head', 'finance', 'company'],
  'deductions.edit': ['finance', 'admin'],
  'retentions.release': ['finance', 'admin'],
  'contracts.edit': ['tech_affairs', 'admin'],
  'records.manage': ['admin'],
};

/** إعدادات افتراضية — بيانات SMTP بتتعدل من شاشة «خادم البريد الإلكتروني» (كلمة السر مشفّرة، مش هنا) */
export const SETTINGS: Record<string, string | number | boolean> = {
  slaWarnAt: 1,
  dailyDigestAt: '08:00',
  weeklyReportDay: 'sun',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpFrom: '',
  smtpFromName: 'منظومة تتبع المستخلصات',
};

/**
 * النصوص السابقة للبيانات المرجعية (قبل توحيد المصطلحات وفق docs/glossary.md).
 * تُحدَّث إلى القيم الحالية أعلاه فقط إذا كانت القيمة المخزنة ما زالت مطابقة للنص القديم،
 * حتى لا تُستبدل أي تعديلات أجراها مدير النظام.
 */
export const LEGACY_TEXT: {
  steps: { key: string; name?: string; short?: string }[];
  categories: { code: string; name: string }[];
  docTypes: { code: string; name: string }[];
  returnReasons: { id: string; name: string }[];
} = {
  steps: [
    { key: 'company', name: 'الشركة المنفذة', short: 'الشركة' },
    { key: 'sup', name: 'مراجعة وتوقيع مشرف التنفيذ' },
    { key: 'tech', name: 'المراجعة الفنية والاعتماد' },
    { key: 'plan', name: 'مراجعة التخطيط لمذكرة التجاوز' },
    { key: 'pres', name: 'موافقة رئاسة القطاعات على التجاوز' },
    { key: 'committee', name: 'اللجنة العليا / تعديل أمر التكليف' },
    { key: 'finance', name: 'الصرف من المالية', short: 'المالية' },
  ],
  categories: [
    { code: 'C1', name: 'لا يوجد تجاوز بنود ولا إجمالي' },
    { code: 'C2', name: 'بند متجاوز والإجمالي لم يتجاوز' },
    { code: 'C3', name: 'الإجمالي تجاوز أمر التكليف حتى 25%' },
    { code: 'C4', name: 'تجاوز أكثر من 25% من أمر التكليف' },
    { code: 'C5', name: 'بند مستجد ليس له سعر في العقد' },
  ],
  docTypes: [
    { code: 'prelim_handover_cert', name: 'شهادة التسليم الابتدائي' },
    { code: 'asbuilt_drawings', name: 'رسومات As-Built' },
    { code: 'stores_return_ack', name: 'إقرار المخازن بالمرتجع' },
    { code: 'asbuilt_maps', name: 'خرائط As-Built' },
    { code: 'prelim_handover_report', name: 'محضر التسليم الابتدائي' },
  ],
  returnReasons: [
    { id: 'rr5', name: 'المهمات غير مطابقة للمنصرف' },
  ],
};
