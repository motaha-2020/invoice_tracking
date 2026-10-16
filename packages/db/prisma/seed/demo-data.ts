// بيانات تطوير وهمية (SEED_DEMO=1) بنفس شكل الديمو — مفيش فيها أي شركة أو عقد أو سعر حقيقي.
// أرقام العقود بتبدأ بـ DEMO- والإيميلات على example.test عشان ماتتلخبطش مع الحقيقي.
import type { Role } from '../../src/index';

export const ORG = {
  presidencies: [
    { code: 'PR1', name: 'رئاسة قطاعات الدلتا والقناة' },
    { code: 'PR2', name: 'رئاسة قطاعات القاهرة الكبرى' },
  ],
  sectors: [
    { code: 'S1', parent: 'PR1', name: 'قطاع الدقهلية ودمياط' },
    { code: 'S2', parent: 'PR1', name: 'قطاع الشرقية' },
    { code: 'S3', parent: 'PR2', name: 'قطاع جنوب القاهرة' },
  ],
  techUnits: [
    { code: 'TA1', parent: 'S1', name: 'الشئون الفنية — قطاع الدقهلية ودمياط' },
    { code: 'TA2', parent: 'S2', name: 'الشئون الفنية — قطاع الشرقية' },
    { code: 'TA3', parent: 'S3', name: 'الشئون الفنية — قطاع جنوب القاهرة' },
  ],
  generalDepts: [
    { code: 'G1', parent: 'S1', name: 'الإدارة العامة لتنفيذ مشروعات الدقهلية' },
    { code: 'G2', parent: 'S1', name: 'الإدارة العامة لتنفيذ مشروعات دمياط' },
    { code: 'G3', parent: 'S2', name: 'الإدارة العامة لتنفيذ مشروعات الشرقية' },
    { code: 'G4', parent: 'S3', name: 'الإدارة العامة لتنفيذ مشروعات المعادي وحلوان' },
  ],
  depts: [
    { code: 'D1', parent: 'G1', name: 'إدارة تنفيذ المنصورة' },
    { code: 'D2', parent: 'G1', name: 'إدارة تنفيذ طلخا' },
    { code: 'D3', parent: 'G2', name: 'إدارة تنفيذ دمياط الجديدة' },
    { code: 'D4', parent: 'G3', name: 'إدارة تنفيذ الزقازيق' },
    { code: 'D5', parent: 'G4', name: 'إدارة تنفيذ المعادي' },
  ],
  centrals: [
    { code: 'C1', parent: 'D1', name: 'سنترال المنصورة الجديد' },
    { code: 'C2', parent: 'D1', name: 'سنترال جديلة' },
    { code: 'C3', parent: 'D2', name: 'سنترال طلخا' },
    { code: 'C4', parent: 'D3', name: 'سنترال دمياط الجديدة' },
    { code: 'C5', parent: 'D4', name: 'سنترال الزقازيق' },
    { code: 'C6', parent: 'D5', name: 'سنترال المعادي' },
    { code: 'C7', parent: 'D5', name: 'سنترال زهراء المعادي' },
  ],
};

/** type = كود نوع المشروع من reference-data */
export const PROJECTS = [
  { code: 'PJ1', type: 'FIBERIZATION', central: 'C1', name: 'FTTH المنصورة الجديدة — المرحلة 2' },
  { code: 'PJ2', type: 'ACCESS', central: 'C2', name: 'كابينات MSAN جديلة' },
  { code: 'PJ3', type: 'FIBERIZATION', central: 'C3', name: 'FTTH طلخا — قرى المركز' },
  { code: 'PJ4', type: 'FTTS', central: 'C4', name: 'حلقة ألياف دمياط الجديدة' },
  { code: 'PJ5', type: 'FIBERIZATION', central: 'C5', name: 'FTTH الزقازيق — حي الزهور' },
  { code: 'PJ6', type: 'USO', central: 'C5', name: 'صيانة غرف تفتيش الزقازيق' },
  { code: 'PJ7', type: 'FIBERIZATION', central: 'C6', name: 'FTTH المعادي — دجلة' },
  { code: 'PJ8', type: 'ACCESS', central: 'C7', name: 'كابينات زهراء المعادي' },
];

export const COMPANIES = [
  { code: 'CO1', name: 'النيل', fullName: 'شركة النيل للمقاولات (تجريبي)', email: 'invoices@nile.example.test', phone: '01000000001' },
  { code: 'CO2', name: 'الدلتا', fullName: 'شركة الدلتا للإنشاءات (تجريبي)', email: 'invoices@delta.example.test', phone: '01000000002' },
  { code: 'CO3', name: 'الواحة', fullName: 'شركة الواحة للهندسة (تجريبي)', email: 'invoices@oasis.example.test', phone: '01000000003' },
];

/** pay = [شهري، As-Built، تسليم]  — priceFactor بيتضرب في أسعار الكتالوج */
export const CONTRACTS = [
  { no: 'DEMO-101/2025', company: 'CO1', title: 'تنفيذ شبكات FTTH بالدقهلية (تجريبي)', start: '2025-03-01', pay: [70, 20, 10], fine: null, priceFactor: 1.0 },
  { no: 'DEMO-102/2024', company: 'CO1', title: 'أعمال مدنية وصيانة الشرقية (تجريبي)', start: '2024-09-15', pay: [90, 0, 10], fine: [2, 10], priceFactor: 0.95 },
  { no: 'DEMO-201/2025', company: 'CO2', title: 'تنفيذ FTTH وكابينات الدلتا (تجريبي)', start: '2025-05-10', pay: [70, 20, 10], fine: null, priceFactor: 1.05 },
  { no: 'DEMO-202/2024', company: 'CO2', title: 'حلقات ألياف رئيسية دمياط (تجريبي)', start: '2024-06-01', pay: [70, 20, 10], fine: null, priceFactor: 1.1 },
  { no: 'DEMO-301/2025', company: 'CO3', title: 'تنفيذ FTTH جنوب القاهرة (تجريبي)', start: '2025-02-01', pay: [90, 0, 10], fine: [2, 10], priceFactor: 1.08 },
  { no: 'DEMO-302/2024', company: 'CO3', title: 'كابينات MSAN المعادي (تجريبي)', start: '2024-11-20', pay: [70, 20, 10], fine: null, priceFactor: 1.0 },
] as const;

/** مقايسة موحدة متدرجة — price null = بند مالوش سعر (C5). qty = الكمية المخططة الافتراضية في أمر التكليف */
export const ITEM_CATALOG: { itemNo: string; description: string; group?: true; unit?: string; price?: number | null; workType?: string; qty?: number }[] = [
  { itemNo: '1', description: 'الأعمال المدنية', group: true },
  { itemNo: '1-1', description: 'غرف التفتيش', group: true },
  { itemNo: '1-1-1-1', description: 'غرفة تفتيش طراز (DH) بأبعاد 70×70×70 سم من الداخل', unit: 'عدد', price: 21000, workType: 'أعمال مدنية', qty: 5 },
  { itemNo: '1-1-1-2', description: 'غرفة تفتيش طراز HH-I', unit: 'عدد', price: 26000, workType: 'أعمال مدنية', qty: 6 },
  { itemNo: '1-4-2', description: 'إنشاء قاعدة كابينة الفايبر Passive Cabinet الخرسانية المسلحة', unit: 'عدد', price: 7000, workType: 'أعمال مدنية', qty: 8 },
  { itemNo: '1-7-2', description: 'الحفر للشبكة الثانوية لجميع أنواع التربة مقاس 35×70 عدا الصخرية', unit: 'م3', price: 330, workType: 'أعمال مدنية', qty: 240 },
  { itemNo: '1-9-1', description: 'حفر ضيق Micro trenching عرض 10–13 سم وعمق 30 سم', unit: 'م.ط', price: 150, workType: 'أعمال مدنية', qty: 2800 },
  { itemNo: '2', description: 'التركيبات', group: true },
  { itemNo: '2-2-6', description: 'Installation of Directly Buried HDPE Single Microduct in open trench', unit: 'م.ط', price: 11, workType: 'تركيبات', qty: 1900 },
  { itemNo: '2-3-1', description: 'كابلات نحاسية من سعة 10 إلى 400 جوز', unit: 'م.ط', price: null, workType: 'تركيبات' },
  { itemNo: '2-6-1', description: 'Installation of Fiber Optic Micro Cables for Capacities 2 to 12 fiber', unit: 'م.ط', price: 11, workType: 'تركيبات', qty: 3700 },
  { itemNo: '2-6-2', description: 'Installation of Fiber Optic Mini Cables for Capacities more than 12 fiber', unit: 'م.ط', price: 16, workType: 'تركيبات', qty: 2100 },
  { itemNo: '2-7-2', description: 'تركيب بودي كابينة توزيع ألياف ضوئية على القاعدة الخرسانية', unit: 'عدد', price: 4000, workType: 'تركيبات', qty: 8 },
  { itemNo: '3', description: 'أعمال التخطيط ورسومات ما بعد التنفيذ', group: true },
  { itemNo: '3-2-1', description: 'أعمال التخطيط شاملة الخرائط المساحية ومسار الربط', unit: 'box', price: 140, workType: 'تخطيط ورسومات', qty: 190 },
  { itemNo: '3-4-1', description: 'أعمال خرائط ما بعد التنفيذ As-Built', unit: 'box', price: 120, workType: 'تخطيط ورسومات', qty: 190 },
  { itemNo: '4', description: 'أعمال الصواعد داخل المباني لتوصيل الفيبر للمشتركين', group: true },
  { itemNo: '4-2-1', description: 'Pulling in Fiber Optic Cables for all capacities in pipes', unit: 'م.ط', price: 40, workType: 'صواعد داخل المباني', qty: 1500 },
  { itemNo: '4-4-2', description: 'Splicing and testing — up to 4 fiber', unit: 'عدد', price: 500, workType: 'صواعد داخل المباني', qty: 110 },
  { itemNo: '5', description: 'أعمال رفع الكفاءة والتكامل مع الشبكة الحالية', group: true },
  { itemNo: '5-5-1', description: 'إحلال كابينة باسيف حالية بكابينة جديدة U22', unit: 'عدد', price: 10000, workType: 'رفع كفاءة', qty: 5 },
];

export const MATERIALS = [
  { code: '1.1.3', description: '8 FIBER OPTIC CABLE', unit: 'KM' },
  { code: '1.1.4', description: '12 FIBER OPTIC CABLE', unit: 'KM' },
  { code: '1.1.7', description: '48 FIBER OPTIC CABLE', unit: 'KM' },
  { code: '2.1.1', description: 'HDPE Single Microduct 14/10 mm', unit: 'M' },
  { code: '3.1.2', description: 'Passive Fiber Cabinet (FDT) 288F', unit: 'عدد' },
  { code: '4.1.1', description: 'Fiber Termination Box (FTB) 4 ports', unit: 'عدد' },
];

/** المهمة اللي بيستهلكها البند: [كود الصنف، معامل الاستهلاك لكل وحدة] */
export const ITEM_MATERIAL: Record<string, [string, number]> = {
  '2-2-6': ['2.1.1', 1.02],
  '2-6-1': ['1.1.4', 0.00105],
  '2-6-2': ['1.1.7', 0.00105],
  '2-7-2': ['3.1.2', 1],
  '4-2-1': ['1.1.3', 0.00105],
  '4-4-2': ['4.1.1', 1],
  '5-5-1': ['3.1.2', 1],
};

/** scale بيكبّر/يصغّر الكميات المخططة عشان أوامر التكليف ماتبقاش متطابقة */
export const AOS = [
  { no: 'WO-2207', contract: 'DEMO-201/2025', project: 'PJ1', date: '2025-07-01', scale: 1.0, sites: 3 },
  { no: 'WO-2231', contract: 'DEMO-201/2025', project: 'PJ2', date: '2025-08-12', scale: 0.7, sites: 2 },
  { no: 'WO-1984', contract: 'DEMO-202/2024', project: 'PJ4', date: '2024-08-20', scale: 1.3, sites: 4 },
  { no: 'WO-2310', contract: 'DEMO-201/2025', project: 'PJ3', date: '2025-10-05', scale: 0.9, sites: 2 },
  { no: 'WO-2115', contract: 'DEMO-101/2025', project: 'PJ1', date: '2025-04-18', scale: 1.1, sites: 3 },
  { no: 'WO-2140', contract: 'DEMO-101/2025', project: 'PJ3', date: '2025-05-22', scale: 0.8, sites: 2 },
  { no: 'WO-1902', contract: 'DEMO-102/2024', project: 'PJ6', date: '2024-10-02', scale: 0.6, sites: 2 },
  { no: 'WO-2188', contract: 'DEMO-101/2025', project: 'PJ5', date: '2025-06-30', scale: 1.2, sites: 3 },
  { no: 'WO-2099', contract: 'DEMO-301/2025', project: 'PJ7', date: '2025-03-15', scale: 1.0, sites: 4 },
  { no: 'WO-2266', contract: 'DEMO-301/2025', project: 'PJ7', date: '2025-09-01', scale: 0.75, sites: 2 },
  { no: 'WO-1955', contract: 'DEMO-302/2024', project: 'PJ8', date: '2024-12-10', scale: 0.9, sites: 3 },
];

type ScopeRef =
  | { type: 'all' }
  | { type: 'company' | 'presidency' | 'sector' | 'general_dept' | 'dept' | 'central'; code: string };

const all = { type: 'all' } as const;
const at = (type: Exclude<ScopeRef['type'], 'all'>, code: string): ScopeRef => ({ type, code });

export const USERS: { name: string; email: string; role: Role; scope: ScopeRef }[] = [
  { name: 'مستخدم PMO', email: 'pmo@example.test', role: 'pmo', scope: all },
  { name: 'مدير النظام (تجريبي)', email: 'admin@example.test', role: 'admin', scope: all },
  { name: 'مسؤول مستخلصات النيل', email: 'co1@example.test', role: 'company', scope: at('company', 'CO1') },
  { name: 'مسؤول مستخلصات الدلتا', email: 'co2@example.test', role: 'company', scope: at('company', 'CO2') },
  { name: 'مسؤول مستخلصات الواحة', email: 'co3@example.test', role: 'company', scope: at('company', 'CO3') },
  { name: 'مشرف تنفيذ المنصورة', email: 'sup.d1@example.test', role: 'supervisor', scope: at('dept', 'D1') },
  { name: 'مشرف تنفيذ طلخا', email: 'sup.d2@example.test', role: 'supervisor', scope: at('dept', 'D2') },
  { name: 'مشرف تنفيذ دمياط', email: 'sup.d3@example.test', role: 'supervisor', scope: at('dept', 'D3') },
  { name: 'مشرف تنفيذ الزقازيق', email: 'sup.d4@example.test', role: 'supervisor', scope: at('dept', 'D4') },
  { name: 'مشرف تنفيذ المعادي', email: 'sup.d5@example.test', role: 'supervisor', scope: at('dept', 'D5') },
  { name: 'مدير تنفيذ المنصورة', email: 'exec.d1@example.test', role: 'exec_mgr', scope: at('dept', 'D1') },
  { name: 'مدير تنفيذ طلخا', email: 'exec.d2@example.test', role: 'exec_mgr', scope: at('dept', 'D2') },
  { name: 'مدير تنفيذ دمياط', email: 'exec.d3@example.test', role: 'exec_mgr', scope: at('dept', 'D3') },
  { name: 'مدير تنفيذ الزقازيق', email: 'exec.d4@example.test', role: 'exec_mgr', scope: at('dept', 'D4') },
  { name: 'مدير تنفيذ المعادي', email: 'exec.d5@example.test', role: 'exec_mgr', scope: at('dept', 'D5') },
  { name: 'مدير عام الدقهلية', email: 'gm.g1@example.test', role: 'gm', scope: at('general_dept', 'G1') },
  { name: 'مدير عام دمياط', email: 'gm.g2@example.test', role: 'gm', scope: at('general_dept', 'G2') },
  { name: 'مدير عام الشرقية', email: 'gm.g3@example.test', role: 'gm', scope: at('general_dept', 'G3') },
  { name: 'مدير عام المعادي', email: 'gm.g4@example.test', role: 'gm', scope: at('general_dept', 'G4') },
  { name: 'الشئون الفنية — الدقهلية', email: 'tech.s1@example.test', role: 'tech_affairs', scope: at('sector', 'S1') },
  { name: 'الشئون الفنية — الشرقية', email: 'tech.s2@example.test', role: 'tech_affairs', scope: at('sector', 'S2') },
  { name: 'الشئون الفنية — جنوب القاهرة', email: 'tech.s3@example.test', role: 'tech_affairs', scope: at('sector', 'S3') },
  { name: 'التخطيط', email: 'planning@example.test', role: 'planning', scope: all },
  { name: 'رئيس قطاع الدقهلية', email: 'sh.s1@example.test', role: 'sector_head', scope: at('sector', 'S1') },
  { name: 'رئيس قطاع الشرقية', email: 'sh.s2@example.test', role: 'sector_head', scope: at('sector', 'S2') },
  { name: 'رئيس قطاع جنوب القاهرة', email: 'sh.s3@example.test', role: 'sector_head', scope: at('sector', 'S3') },
  { name: 'رئاسة الدلتا', email: 'pres.pr1@example.test', role: 'presidency_head', scope: at('presidency', 'PR1') },
  { name: 'رئاسة القاهرة', email: 'pres.pr2@example.test', role: 'presidency_head', scope: at('presidency', 'PR2') },
  { name: 'أمانة اللجنة العليا', email: 'committee@example.test', role: 'committee', scope: all },
  { name: 'مخازن الدلتا', email: 'stores.pr1@example.test', role: 'stores', scope: at('presidency', 'PR1') },
  { name: 'مخازن القاهرة', email: 'stores.pr2@example.test', role: 'stores', scope: at('presidency', 'PR2') },
  { name: 'المالية', email: 'finance@example.test', role: 'finance', scope: all },
  { name: 'المكتب الفني — الدقهلية', email: 'office.s1@example.test', role: 'tech_office', scope: at('sector', 'S1') },
];
