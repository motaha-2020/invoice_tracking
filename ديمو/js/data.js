/* ============================================================
   data.js — بيانات تجريبية بنفس شكل جداول قاعدة البيانات (ERD)
   كل جدول = array. المفاتيح الأجنبية بتنتهي بـ Id.
   المستخلصات نفسها بتتولد في seed.js باستخدام نفس دوال المسار في core.js
   ============================================================ */
const DB = {
  /* ── الهيكل التنظيمي: رئاسة قطاعات ← قطاع ← إدارة عامة ← إدارة مختصة ← سنترال ── */
  presidencies: [
    { id: 'pr1', name: 'رئاسة قطاعات الدلتا والقناة' },
    { id: 'pr2', name: 'رئاسة قطاعات القاهرة الكبرى' },
  ],
  sectors: [
    { id: 's1', presidencyId: 'pr1', name: 'قطاع الدقهلية ودمياط' },
    { id: 's2', presidencyId: 'pr1', name: 'قطاع الشرقية' },
    { id: 's3', presidencyId: 'pr2', name: 'قطاع جنوب القاهرة' },
  ],
  gdepts: [
    { id: 'g1', sectorId: 's1', name: 'الإدارة العامة لتنفيذ مشروعات الدقهلية' },
    { id: 'g2', sectorId: 's1', name: 'الإدارة العامة لتنفيذ مشروعات دمياط' },
    { id: 'g3', sectorId: 's2', name: 'الإدارة العامة لتنفيذ مشروعات الشرقية' },
    { id: 'g4', sectorId: 's3', name: 'الإدارة العامة لتنفيذ مشروعات المعادي وحلوان' },
  ],
  depts: [
    { id: 'd1', gdeptId: 'g1', name: 'إدارة تنفيذ المنصورة' },
    { id: 'd2', gdeptId: 'g1', name: 'إدارة تنفيذ طلخا' },
    { id: 'd3', gdeptId: 'g2', name: 'إدارة تنفيذ دمياط الجديدة' },
    { id: 'd4', gdeptId: 'g3', name: 'إدارة تنفيذ الزقازيق' },
    { id: 'd5', gdeptId: 'g4', name: 'إدارة تنفيذ المعادي' },
  ],
  centrals: [
    { id: 'c1', deptId: 'd1', name: 'سنترال المنصورة الجديد' },
    { id: 'c2', deptId: 'd1', name: 'سنترال جديلة' },
    { id: 'c3', deptId: 'd2', name: 'سنترال طلخا' },
    { id: 'c4', deptId: 'd3', name: 'سنترال دمياط الجديدة' },
    { id: 'c5', deptId: 'd4', name: 'سنترال الزقازيق' },
    { id: 'c6', deptId: 'd5', name: 'سنترال المعادي' },
    { id: 'c7', deptId: 'd5', name: 'سنترال زهراء المعادي' },
  ],

  /* الشئون الفنية — وحدة لكل قطاع (الـ Admin بيضيفها) */
  techUnits: [
    { id: 'ta1', sectorId: 's1', name: 'الشئون الفنية — قطاع الدقهلية ودمياط' },
    { id: 'ta2', sectorId: 's2', name: 'الشئون الفنية — قطاع الشرقية' },
    { id: 'ta3', sectorId: 's3', name: 'الشئون الفنية — قطاع جنوب القاهرة' },
  ],

  /* ── أنواع المشاريع والمشاريع ── */
  projectTypes: [
    { id: 't1', name: 'FTTH — ألياف للمنازل' },
    { id: 't2', name: 'كابينات MSAN' },
    { id: 't3', name: 'كوابل ألياف رئيسية' },
    { id: 't4', name: 'أعمال مدنية وصيانة' },
  ],
  projects: [
    { id: 'pj1', typeId: 't1', centralId: 'c1', name: 'FTTH المنصورة الجديدة — المرحلة 2' },
    { id: 'pj2', typeId: 't2', centralId: 'c2', name: 'كابينات MSAN جديلة' },
    { id: 'pj3', typeId: 't1', centralId: 'c3', name: 'FTTH طلخا — قرى المركز' },
    { id: 'pj4', typeId: 't3', centralId: 'c4', name: 'حلقة ألياف دمياط الجديدة' },
    { id: 'pj5', typeId: 't1', centralId: 'c5', name: 'FTTH الزقازيق — حي الزهور' },
    { id: 'pj6', typeId: 't4', centralId: 'c5', name: 'صيانة غرف تفتيش الزقازيق' },
    { id: 'pj7', typeId: 't1', centralId: 'c6', name: 'FTTH المعادي — دجلة' },
    { id: 'pj8', typeId: 't2', centralId: 'c7', name: 'كابينات زهراء المعادي' },
  ],

  /* ── الشركات والعقود ── */
  companies: [
    { id: 'co1', name: 'الصفا', fullName: 'شركة الصفا للمقاولات والاتصالات', email: 'finance@alsafa.com', phone: '01000000001' },
    { id: 'co2', name: 'بريدج', fullName: 'شركة بريدج للإنشاءات', email: 'invoices@bridge.com', phone: '01000000002' },
    { id: 'co3', name: 'المعادي', fullName: 'شركة المعادي للهندسة', email: 'acc@maadi-eng.com', phone: '01000000003' },
  ],
  contracts: [
    { id: 'k1', no: '77/2025/1/5', companyId: 'co1', title: 'تنفيذ شبكات FTTH بالدقهلية', currency: 'EGP', vatPct: 14, taxPct: 1, payMonthlyPct: 70, asbuiltPct: 20, handoverPct: 10, finalGuaranteePct: 5, delayFinePctWeek: 0, delayFineCapPct: 0, warrantyMonths: 12, priceFactor: 1.00, start: '2025-03-01' },
    { id: 'k2', no: '301/2024/3/9', companyId: 'co1', title: 'أعمال مدنية وصيانة الشرقية', currency: 'EGP', vatPct: 14, taxPct: 1, payMonthlyPct: 90, asbuiltPct: 0, handoverPct: 10, finalGuaranteePct: 5, delayFinePctWeek: 2, delayFineCapPct: 10, warrantyMonths: 12, priceFactor: 0.95, start: '2024-09-15' },
    { id: 'k3', no: '232/2025/1/36', companyId: 'co2', title: 'تنفيذ FTTH وكابينات الدلتا', currency: 'EGP', vatPct: 14, taxPct: 1, payMonthlyPct: 70, asbuiltPct: 20, handoverPct: 10, finalGuaranteePct: 5, delayFinePctWeek: 0, delayFineCapPct: 0, warrantyMonths: 12, priceFactor: 1.05, start: '2025-05-10' },
    { id: 'k4', no: '118/2024/2/12', companyId: 'co2', title: 'حلقات ألياف رئيسية دمياط', currency: 'EGP', vatPct: 14, taxPct: 1, payMonthlyPct: 70, asbuiltPct: 20, handoverPct: 10, finalGuaranteePct: 5, delayFinePctWeek: 0, delayFineCapPct: 0, warrantyMonths: 12, priceFactor: 1.10, start: '2024-06-01' },
    { id: 'k5', no: '45/2025/1/2', companyId: 'co3', title: 'تنفيذ FTTH جنوب القاهرة', currency: 'EGP', vatPct: 14, taxPct: 1, payMonthlyPct: 90, asbuiltPct: 0, handoverPct: 10, finalGuaranteePct: 5, delayFinePctWeek: 2, delayFineCapPct: 10, warrantyMonths: 12, priceFactor: 1.08, start: '2025-02-01' },
    { id: 'k6', no: '190/2024/1/14', companyId: 'co3', title: 'كابينات MSAN المعادي', currency: 'EGP', vatPct: 14, taxPct: 1, payMonthlyPct: 70, asbuiltPct: 20, handoverPct: 10, finalGuaranteePct: 5, delayFinePctWeek: 0, delayFineCapPct: 0, warrantyMonths: 12, priceFactor: 1.00, start: '2024-11-20' },
  ],

  /* مقايسة موحدة متدرجة (نفس شكل مقايسة FTTx الحقيقية: 1 ← 1-1 ← 1-1-1-1)
     group = صف عنوان من غير وحدة ولا سعر. price=null = البند مالوش سعر في العقد (→ C5)
     كل عقد بياخد نسخة منها بأسعار مضروبة في priceFactor */
  itemCatalog: [
    { itemNo: '1', description: 'الأعمال المدنية', group: true },
    { itemNo: '1-1', description: 'غرف التفتيش', group: true },
    { itemNo: '1-1-1-1', description: 'غرفة تفتيش طراز (DH) بأبعاد 70×70×70 سم من الداخل', unit: 'عدد', price: 21000, workType: 'أعمال مدنية' },
    { itemNo: '1-1-1-2', description: 'غرفة تفتيش طراز HH-I', unit: 'عدد', price: 26000, workType: 'أعمال مدنية' },
    { itemNo: '1-4-2', description: 'إنشاء قاعدة كابينة الفايبر Passive Cabinet الخرسانية المسلحة', unit: 'عدد', price: 7000, workType: 'أعمال مدنية' },
    { itemNo: '1-7-2', description: 'الحفر للشبكة الثانوية لجميع أنواع التربة مقاس 35×70 عدا الصخرية', unit: 'م3', price: 330, workType: 'أعمال مدنية' },
    { itemNo: '1-9-1', description: 'حفر ضيق Micro trenching عرض 10–13 سم وعمق 30 سم', unit: 'م.ط', price: 150, workType: 'أعمال مدنية' },
    { itemNo: '2', description: 'التركيبات', group: true },
    { itemNo: '2-2-6', description: 'Installation of Directly Buried HDPE Single Microduct in open trench', unit: 'م.ط', price: 11, workType: 'تركيبات', material: '2.1.1', matFactor: 1.02 },
    { itemNo: '2-3-1', description: 'كابلات نحاسية من سعة 10 إلى 400 جوز', unit: 'م.ط', price: null, workType: 'تركيبات' },
    { itemNo: '2-6-1', description: 'Installation of Fiber Optic Micro Cables for Capacities 2 to 12 fiber', unit: 'م.ط', price: 11, workType: 'تركيبات', material: '1.1.4', matFactor: 0.00105 },
    { itemNo: '2-6-2', description: 'Installation of Fiber Optic Mini Cables for Capacities more than 12 fiber', unit: 'م.ط', price: 16, workType: 'تركيبات', material: '1.1.7', matFactor: 0.00105 },
    { itemNo: '2-7-2', description: 'تركيب بودي كابينة توزيع ألياف ضوئية على القاعدة الخرسانية', unit: 'عدد', price: 4000, workType: 'تركيبات', material: '3.1.2', matFactor: 1 },
    { itemNo: '3', description: 'أعمال التخطيط ورسومات ما بعد التنفيذ', group: true },
    { itemNo: '3-2-1', description: 'أعمال التخطيط شاملة الخرائط المساحية ومسار الربط', unit: 'box', price: 140, workType: 'تخطيط ورسومات' },
    { itemNo: '3-4-1', description: 'أعمال خرائط ما بعد التنفيذ As-Built', unit: 'box', price: 120, workType: 'تخطيط ورسومات' },
    { itemNo: '4', description: 'أعمال الصواعد داخل المباني لتوصيل الفيبر للمشتركين', group: true },
    { itemNo: '4-2-1', description: 'Pulling in Fiber Optic Cables for all capacities in pipes', unit: 'م.ط', price: 40, workType: 'صواعد داخل المباني', material: '1.1.3', matFactor: 0.00105 },
    { itemNo: '4-4-2', description: 'Splicing and testing — up to 4 fiber', unit: 'عدد', price: 500, workType: 'صواعد داخل المباني', material: '4.1.1', matFactor: 1 },
    { itemNo: '5', description: 'أعمال رفع الكفاءة والتكامل مع الشبكة الحالية', group: true },
    { itemNo: '5-5-1', description: 'إحلال كابينة باسيف حالية بكابينة جديدة U22', unit: 'عدد', price: 10000, workType: 'رفع كفاءة', material: '3.1.2', matFactor: 1 },
  ],
  contractItems: [], // بيتملى تحت من الكتالوج

  /* ── كتالوج المهمات (توريد المصرية) — رقم الشطب/كود الصنف زي "بيان مهمات المستخلص" ── */
  materials: [
    { code: '1.1.3', description: '8 FIBER OPTIC CABLE', unit: 'KM' },
    { code: '1.1.4', description: '12 FIBER OPTIC CABLE', unit: 'KM' },
    { code: '1.1.7', description: '48 FIBER OPTIC CABLE', unit: 'KM' },
    { code: '2.1.1', description: 'HDPE Single Microduct 14/10 mm', unit: 'M' },
    { code: '3.1.2', description: 'Passive Fiber Cabinet (FDT) 288F', unit: 'عدد' },
    { code: '4.1.1', description: 'Fiber Termination Box (FTB) 4 ports', unit: 'عدد' },
  ],

  /* ── أوامر التكليف + بنودها المخططة + مهماتها المخططة + المنصرف ── */
  aos: [
    { id: 'ao1', no: 'WO-2207', contractId: 'k3', projectId: 'pj1', date: '2025-07-01' },
    { id: 'ao2', no: 'WO-2231', contractId: 'k3', projectId: 'pj2', date: '2025-08-12' },
    { id: 'ao3', no: 'WO-1984', contractId: 'k4', projectId: 'pj4', date: '2024-08-20' },
    { id: 'ao4', no: 'WO-2310', contractId: 'k3', projectId: 'pj3', date: '2025-10-05' },
    { id: 'ao5', no: 'WO-2115', contractId: 'k1', projectId: 'pj1', date: '2025-04-18' },
    { id: 'ao6', no: 'WO-2140', contractId: 'k1', projectId: 'pj3', date: '2025-05-22' },
    { id: 'ao7', no: 'WO-1902', contractId: 'k2', projectId: 'pj6', date: '2024-10-02' },
    { id: 'ao8', no: 'WO-2188', contractId: 'k1', projectId: 'pj5', date: '2025-06-30' },
    { id: 'ao9', no: 'WO-2099', contractId: 'k5', projectId: 'pj7', date: '2025-03-15' },
    { id: 'ao10', no: 'WO-2266', contractId: 'k5', projectId: 'pj7', date: '2025-09-01' },
    { id: 'ao11', no: 'WO-1955', contractId: 'k6', projectId: 'pj8', date: '2024-12-10' },
  ],
  aoSites: [],      // { aoId, code, name } — مواقع/كابينات أمر التكليف
  aoItems: [],      // { aoId, itemId, plannedQty }
  aoMaterials: [],  // { aoId, code, plannedQty }
  materialIssues: [], // { id, aoId, code, qty, date, ref }

  /* ── المستندات المطلوبة ── */
  docTypes: [
    { id: 'dt1', name: 'نسخة المستخلص الورقي الموقّعة' },
    { id: 'dt2', name: 'محضر الحصر المشترك' },
    { id: 'dt3', name: 'صور الموقع' },
    { id: 'dt4', name: 'محضر الاختبارات والقياسات' },
    { id: 'dt5', name: 'شهادة التسليم الابتدائي' },
    { id: 'dt6', name: 'شهادة الضمان' },
    { id: 'dt7', name: 'رسومات As-Built' },
    { id: 'dt8', name: 'إقرار المخازن بالمرتجع' },
    { id: 'dt9', name: 'مذكرة التجاوز' },
  ],
  requiredDocs: { // نوع المشروع ← المستندات الإلزامية
    t1: ['dt1', 'dt2', 'dt3', 'dt4', 'dt7'],
    t2: ['dt1', 'dt2', 'dt3', 'dt5'],
    t3: ['dt1', 'dt2', 'dt4', 'dt7'],
    t4: ['dt1', 'dt2', 'dt3'],
  },

  /* ── أسباب الإرجاع ── */
  returnReasons: [
    { id: 'rr1', name: 'توقيع أو ختم ناقص' },
    { id: 'rr2', name: 'مستند مطلوب غير مرفق' },
    { id: 'rr3', name: 'الكميات غير مطابقة للحصر' },
    { id: 'rr4', name: 'تجاوز غير مبرر عن أمر التكليف' },
    { id: 'rr5', name: 'المهمات غير مطابقة للمنصرف' },
    { id: 'rr6', name: 'خطأ في الحسابات أو الأسعار' },
    { id: 'rr7', name: 'اختلاف في بيانات العقد أو أمر التكليف' },
    { id: 'rr8', name: 'صور أو رسومات غير واضحة' },
    { id: 'rr9', name: 'أخرى (موضّحة في الملاحظات)' },
  ],

  /* ── محطات المسار (كل محطة = دور مسؤول) ── */
  steps: {
    company:   { name: 'الشركة المنفذة',                      short: 'الشركة',            role: 'company' },
    sup:       { name: 'مراجعة وتوقيع مشرف التنفيذ',          short: 'مشرف التنفيذ',      role: 'supervisor' },
    exec:      { name: 'مراجعة واعتماد مدير التنفيذ',          short: 'إدارة التنفيذ',     role: 'exec_mgr' },
    gm:        { name: 'مراجعة واعتماد المدير العام',          short: 'المدير العام',      role: 'gm' },
    tech:      { name: 'المراجعة الفنية والاعتماد',            short: 'الشئون الفنية',     role: 'tech_affairs' },
    plan:      { name: 'مراجعة التخطيط لمذكرة التجاوز',        short: 'التخطيط',           role: 'planning' },
    pres:      { name: 'موافقة رئاسة القطاعات على التجاوز',    short: 'رئاسة القطاعات',    role: 'presidency_head' },
    committee: { name: 'اللجنة العليا / تعديل أمر التكليف',     short: 'اللجنة العليا',     role: 'committee' },
    pricing:   { name: 'تسعير البند المستجد',                   short: 'التسعير',           role: 'planning' },
    sector:    { name: 'اعتماد رئيس القطاع',                    short: 'رئيس القطاع',       role: 'sector_head' },
    stores:    { name: 'مراجعة المخازن والمشتريات',             short: 'المخازن والمشتريات', role: 'stores' },
    finance:   { name: 'الصرف من المالية',                      short: 'المالية',           role: 'finance' },
  },
  /* ── المسار والـ SLA (أيام عمل) لكل فئة — قابل للتعديل من شاشة الإعدادات ── */
  categories: {
    C1: { name: 'لا يوجد تجاوز بنود ولا إجمالي',        path: [['sup', null], ['exec', 2], ['gm', 1], ['tech', 2], ['stores', 2], ['finance', 3]] },
    C2: { name: 'بند متجاوز والإجمالي لم يتجاوز',        path: [['sup', null], ['exec', 1], ['gm', 1], ['tech', 4], ['plan', 3], ['stores', 2], ['finance', 3]] },
    C3: { name: 'الإجمالي تجاوز أمر التكليف حتى 25%',   path: [['sup', null], ['exec', 1], ['gm', 1], ['tech', 4], ['plan', 3], ['sector', 1], ['stores', 2], ['finance', 3]] },
    C4: { name: 'تجاوز أكثر من 25% من أمر التكليف',      path: [['sup', null], ['exec', 1], ['gm', 1], ['tech', 4], ['plan', 3], ['pres', 1], ['committee', 7], ['sector', 1], ['stores', 2], ['finance', 3]] },
    C5: { name: 'بند مستجد ليس له سعر في العقد',          path: [['sup', null], ['exec', 1], ['gm', 1], ['tech', 4], ['plan', 3], ['pricing', 10], ['pres', 1], ['committee', 7], ['sector', 1], ['stores', 2], ['finance', 3]] },
  },
  slaWarnAt: 1, // يتلوّن أصفر لما يفضل يوم واحد أو أقل

  /* ── الاستقطاعات (قيم افتراضية — المالية بتعدّلها) ── */
  /* ── جدول الدفع والاستقطاعات (زي العقود الحقيقية: 70% شهري / 20% بعد As-Built / 10% بعد التسليم الابتدائي — أو 90/10) ──
     المحجوز (releasable) بيتصرف لما المرحلة تتحقق. الدمغات بتتدفع مرة واحدة على أمر التكليف مش على المستخلص. */
  deductionTypes: [
    { id: 'asbuilt',  name: 'محجوز لحد تسليم خرائط As-Built', basis: 'asbuiltPct', releasable: true },
    { id: 'handover', name: 'محجوز لحد التسليم الابتدائي', basis: 'handoverPct', releasable: true },
    { id: 'tax',      name: 'خصم ضريبي من المنبع', basis: 'taxPct' },
    { id: 'penalty',  name: 'غرامة تأخير', basis: null },
  ],

  /* ── الأدوار ونطاقها ── */
  roles: {
    admin:           { label: 'مدير النظام',            scope: 'all' },
    pmo:             { label: 'فريق المتابعة PMO',     scope: 'all' },
    company:         { label: 'شركة منفذة',             scope: 'company' },
    supervisor:      { label: 'مشرف تنفيذ',             scope: 'dept' },
    exec_mgr:        { label: 'مدير تنفيذ',             scope: 'dept' },
    gm:              { label: 'مدير عام',               scope: 'gdept' },
    tech_affairs:    { label: 'الشئون الفنية',          scope: 'sector' },
    tech_office:     { label: 'مكتب فني',               scope: 'sector' },
    planning:        { label: 'التخطيط',                scope: 'all' },
    sector_head:     { label: 'رئيس قطاع',              scope: 'sector' },
    presidency_head: { label: 'رئاسة القطاعات',         scope: 'presidency' },
    committee:       { label: 'اللجنة العليا',          scope: 'all' },
    stores:          { label: 'المخازن والمشتريات',     scope: 'sector' },
    finance:         { label: 'المالية',                scope: 'all' },
  },
  /* صلاحيات إضافية لكل دور (غير الاعتماد في محطته) */
  permissions: {
    'invoice.create':   ['company'],
    'invoice.viewAll':  ['admin', 'pmo'],
    'invoice.override': ['admin', 'pmo'],        // يحرّك أي محطة بدل الإدارة
    'master.import':    ['admin', 'tech_affairs'], // رفع العقود وأوامر التكليف
    'issues.import':    ['admin', 'stores'],       // رفع المنصرف
    'users.manage':     ['admin'],
    'workflow.config':  ['admin', 'pmo'],
    'reports.view':     ['admin', 'pmo', 'exec_mgr', 'gm', 'tech_affairs', 'tech_office', 'planning', 'sector_head', 'presidency_head', 'stores', 'finance', 'company'],
    'reports.export':   ['admin', 'pmo', 'gm', 'tech_affairs', 'sector_head', 'presidency_head', 'finance', 'company'],
    'deductions.edit':  ['finance', 'admin'],
  },

  /* ── المستخدمين: دور + نطاق ── */
  users: [
    { id: 'u1',  name: 'محمد طه',            email: 'pmo@te.eg',              role: 'pmo',             scope: { type: 'all' } },
    { id: 'u2',  name: 'م. خالد عبد الحميد', email: 'admin@te.eg',            role: 'admin',           scope: { type: 'all' } },
    { id: 'u3',  name: 'مسؤول مستخلصات بريدج', email: 'invoices@bridge.com',  role: 'company',         scope: { type: 'company', id: 'co2' } },
    { id: 'u4',  name: 'مسؤول مستخلصات الصفا', email: 'finance@alsafa.com',   role: 'company',         scope: { type: 'company', id: 'co1' } },
    { id: 'u5',  name: 'مسؤول مستخلصات المعادي', email: 'acc@maadi-eng.com',  role: 'company',         scope: { type: 'company', id: 'co3' } },
    { id: 'u30', name: 'م. طارق شعراوي',     email: 'sup.mansoura@te.eg',     role: 'supervisor',      scope: { type: 'dept', id: 'd1' } },
    { id: 'u31', name: 'م. أحمد سعيد',       email: 'sup.talkha@te.eg',       role: 'supervisor',      scope: { type: 'dept', id: 'd2' } },
    { id: 'u32', name: 'م. حمدي عبد الرحمن', email: 'sup.damietta@te.eg',     role: 'supervisor',      scope: { type: 'dept', id: 'd3' } },
    { id: 'u33', name: 'م. محمد عبد الله',   email: 'sup.zagazig@te.eg',      role: 'supervisor',      scope: { type: 'dept', id: 'd4' } },
    { id: 'u34', name: 'م. إبراهيم مكرم',    email: 'sup.maadi@te.eg',        role: 'supervisor',      scope: { type: 'dept', id: 'd5' } },
    { id: 'u6',  name: 'م. محمود فتحي',      email: 'exec.mansoura@te.eg',    role: 'exec_mgr',        scope: { type: 'dept', id: 'd1' } },
    { id: 'u7',  name: 'م. عمرو إسماعيل',    email: 'exec.talkha@te.eg',      role: 'exec_mgr',        scope: { type: 'dept', id: 'd2' } },
    { id: 'u8',  name: 'م. نادر شوقي',       email: 'exec.damietta@te.eg',    role: 'exec_mgr',        scope: { type: 'dept', id: 'd3' } },
    { id: 'u9',  name: 'م. هاني رمضان',      email: 'exec.zagazig@te.eg',     role: 'exec_mgr',        scope: { type: 'dept', id: 'd4' } },
    { id: 'u10', name: 'م. رانيا سعيد',      email: 'exec.maadi@te.eg',       role: 'exec_mgr',        scope: { type: 'dept', id: 'd5' } },
    { id: 'u11', name: 'م. أشرف الجندي',     email: 'gm.dakahlia@te.eg',      role: 'gm',              scope: { type: 'gdept', id: 'g1' } },
    { id: 'u12', name: 'م. سامي النجار',     email: 'gm.damietta@te.eg',      role: 'gm',              scope: { type: 'gdept', id: 'g2' } },
    { id: 'u13', name: 'م. وليد مصطفى',      email: 'gm.sharqia@te.eg',       role: 'gm',              scope: { type: 'gdept', id: 'g3' } },
    { id: 'u14', name: 'م. منى فاروق',       email: 'gm.maadi@te.eg',         role: 'gm',              scope: { type: 'gdept', id: 'g4' } },
    { id: 'u15', name: 'م. هشام علي',        email: 'tech.delta@te.eg',       role: 'tech_affairs',    scope: { type: 'sector', id: 's1' } },
    { id: 'u16', name: 'م. إيمان حسن',       email: 'tech.sharqia@te.eg',     role: 'tech_affairs',    scope: { type: 'sector', id: 's2' } },
    { id: 'u17', name: 'م. طارق سليمان',     email: 'tech.cairo@te.eg',       role: 'tech_affairs',    scope: { type: 'sector', id: 's3' } },
    { id: 'u18', name: 'م. صفية عادل',       email: 'planning@te.eg',         role: 'planning',        scope: { type: 'all' } },
    { id: 'u19', name: 'مكتب رئيس قطاع الدقهلية', email: 'sh.dakahlia@te.eg', role: 'sector_head',     scope: { type: 'sector', id: 's1' } },
    { id: 'u20', name: 'مكتب رئيس قطاع الشرقية', email: 'sh.sharqia@te.eg',   role: 'sector_head',     scope: { type: 'sector', id: 's2' } },
    { id: 'u21', name: 'مكتب رئيس قطاع جنوب القاهرة', email: 'sh.cairo@te.eg', role: 'sector_head',    scope: { type: 'sector', id: 's3' } },
    { id: 'u22', name: 'مكتب رئيس رئاسة الدلتا', email: 'pres.delta@te.eg',   role: 'presidency_head', scope: { type: 'presidency', id: 'pr1' } },
    { id: 'u23', name: 'مكتب رئيس رئاسة القاهرة', email: 'pres.cairo@te.eg',  role: 'presidency_head', scope: { type: 'presidency', id: 'pr2' } },
    { id: 'u24', name: 'أمانة اللجنة العليا', email: 'committee@te.eg',       role: 'committee',       scope: { type: 'all' } },
    { id: 'u25', name: 'أ. محمود عبد الله',  email: 'stores.delta@te.eg',     role: 'stores',          scope: { type: 'presidency', id: 'pr1' } },
    { id: 'u26', name: 'أ. ياسر كمال',       email: 'stores.cairo@te.eg',     role: 'stores',          scope: { type: 'presidency', id: 'pr2' } },
    { id: 'u27', name: 'أ. سامح المالية',    email: 'finance@te.eg',          role: 'finance',         scope: { type: 'all' } },
    { id: 'u28', name: 'أ. ياسمين المكتب الفني', email: 'office.delta@te.eg', role: 'tech_office',     scope: { type: 'sector', id: 's1' } },
  ],
  delegations: [ // تفويض وقت الأجازات
    { fromUserId: 'u11', toUserId: 'u6', from: '2026-10-18', to: '2026-10-22', note: 'أجازة سنوية' },
  ],

  holidays: ['2026-01-07', '2026-01-25', '2026-04-12', '2026-04-13', '2026-04-25', '2026-05-01', '2026-05-26', '2026-05-27', '2026-05-28', '2026-06-16', '2026-06-30', '2026-07-23', '2026-08-25', '2026-10-06'],

  settings: { smtpHost: 'smtp-relay.brevo.com', smtpPort: 587, smtpFrom: 'invoices@te.eg', dailyDigestAt: '08:00', weeklyReportDay: 'الأحد' },

  /* بتتملى من seed.js */
  invoices: [],
  notifications: [], // { id, userId, title, invoiceId, date, read }
  emails: [],        // outbox: { id, to, subject, body, invoiceId, date, status }
  audit: [],         // { date, userId, action, entity, details }
};

/* ── توليد بنود العقود + بنود ومهمات أوامر التكليف + المنصرف (deterministic) ── */
(function buildMasterData() {
  let seed = 11;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

  const r2 = v => Math.round(v * 100) / 100;

  DB.contracts.forEach(k => {
    DB.itemCatalog.forEach(c => {
      DB.contractItems.push({
        id: `${k.id}-${c.itemNo}`, contractId: k.id, itemNo: c.itemNo, parentNo: c.itemNo.split('-').slice(0, -1).join('-'),
        isGroup: !!c.group, description: c.description, unit: c.unit || '',
        unitPrice: c.group || c.price == null ? null : Math.round(c.price * k.priceFactor), workType: c.workType || '',
      });
    });
  });

  // نطاق الكميات المخططة لكل بند في أمر التكليف
  const ranges = { '1-1-1-1': [2, 8], '1-1-1-2': [2, 10], '1-4-2': [3, 12], '1-7-2': [60, 420], '1-9-1': [1200, 4500], '2-2-6': [900, 3000], '2-6-1': [1500, 6000], '2-6-2': [800, 3500], '2-7-2': [3, 12], '3-2-1': [80, 300], '3-4-1': [80, 300], '4-2-1': [600, 2400], '4-4-2': [40, 180], '5-5-1': [2, 8] };
  DB.aos.forEach(ao => {
    // كل أمر تكليف ليه 2–4 مواقع (كابينات) زي ملفات الزيادة الحقيقية (#75, #76 ...)
    const n = ri(2, 4), base = ri(60, 140);
    for (let s = 0; s < n; s++) DB.aoSites.push({ aoId: ao.id, code: '#' + (base + s), name: `كابينة ${base + s}` });
    const items = DB.contractItems.filter(i => i.contractId === ao.contractId && !i.isGroup && i.unitPrice != null);
    items.forEach(it => {
      if (rnd() < 0.2 && !['1-9-1', '2-6-1'].includes(it.itemNo)) return; // مش كل البنود في كل أمر تكليف
      const [a, b] = ranges[it.itemNo];
      DB.aoItems.push({ aoId: ao.id, itemId: it.id, plannedQty: ri(a, b) });
    });
    // المهمات المخططة مشتقة من البنود (أكتر من بند ممكن يستهلك نفس الصنف)
    const planned = {};
    DB.itemCatalog.filter(c => c.material).forEach(c => {
      const line = DB.aoItems.find(x => x.aoId === ao.id && x.itemId === `${ao.contractId}-${c.itemNo}`);
      if (line) planned[c.material] = (planned[c.material] || 0) + line.plannedQty * c.matFactor;
    });
    Object.entries(planned).forEach(([code, q]) => {
      const pq = q < 50 ? r2(q) : Math.round(q);
      DB.aoMaterials.push({ aoId: ao.id, code, plannedQty: pq });
      // المنصرف من المخازن (دفعات بأذون صرف)
      const total = pq * (0.85 + rnd() * 0.35);
      const parts = ri(1, 3);
      for (let p = 0; p < parts; p++) {
        const qv = total / parts;
        DB.materialIssues.push({ id: `mi-${ao.id}-${code}-${p}`, aoId: ao.id, code, qty: pq < 50 ? r2(qv) : Math.round(qv), date: `2026-0${ri(3, 9)}-${String(ri(1, 28)).padStart(2, '0')}`, ref: 'إذن صرف ' + ri(1000, 9999) });
      }
    });
  });
})();
