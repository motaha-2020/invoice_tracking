"""
build_templates.py — يبني قوالب Excel الموحدة لكل بيانات بتدخل على المنظومة.
التشغيل:  python -I scripts/build_templates.py templates
كل قالب:
  - شيتات البيانات أولاً (أسماء ثابتة — الـ parser بيقرأ بالاسم)
  - صف العناوين: عربي + (اسم العمود التقني) ، والإلزامي عليه *
  - قوايم اختيار (Data Validation) للأعمدة المقفولة
  - صفوف مثال باللون الرمادي (بتتمسح قبل الرفع أو السيستم بيتجاهل أي صف أوله "مثال")
  - شيت "تعليمات" + شيت مخفي "_meta" فيه نوع القالب ونسخته
"""
import json
import os
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

sys.stdout.reconfigure(encoding="utf-8")
OUT = sys.argv[1] if len(sys.argv) > 1 else "templates"
os.makedirs(OUT, exist_ok=True)
VERSION = "1.0"

PURPLE = "5C2D91"
HDR_FILL = PatternFill("solid", fgColor=PURPLE)
REQ_FILL = PatternFill("solid", fgColor="3D1A63")
EX_FILL = PatternFill("solid", fgColor="F0F0F3")
GROUP_FILL = PatternFill("solid", fgColor="EDE5F4")
THIN = Side(style="thin", color="DEDEE4")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
FONT = "Cairo"

ROLES = ["admin", "pmo", "company", "supervisor", "exec_mgr", "gm", "tech_affairs", "tech_office", "planning",
         "sector_head", "presidency_head", "committee", "stores", "finance"]
SCOPES = ["all", "company", "presidency", "sector", "gdept", "dept", "central"]


def col(key, label, width=18, req=False, hint="", options=None, kind="text"):
    return dict(key=key, label=label, width=width, req=req, hint=hint, options=options, kind=kind)


def add_sheet(wb, title, cols, examples=(), group_rows=()):
    ws = wb.create_sheet(title)
    ws.sheet_view.rightToLeft = True
    for j, c in enumerate(cols, 1):
        cell = ws.cell(row=1, column=j, value=f"{c['label']}{' *' if c['req'] else ''}")
        cell.font = Font(name=FONT, bold=True, color="FFFFFF", size=11)
        cell.fill = REQ_FILL if c["req"] else HDR_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER
        tech = ws.cell(row=2, column=j, value=c["key"])
        tech.font = Font(name="Consolas", size=9, color="71717F")
        tech.alignment = Alignment(horizontal="center")
        tech.fill = PatternFill("solid", fgColor="FAFAFB")
        tech.border = BORDER
        # الشرح بيروح لشيت "تعليمات" مش comment على الخلية — exceljs (في المنظومة) مش بيقرا comments بتاعة openpyxl
        if c["hint"]:
            if not hasattr(wb, "_hints"):
                wb._hints = []
            wb._hints.append((title, c["label"], c["hint"]))
        ws.column_dimensions[get_column_letter(j)].width = c["width"]
        if c["options"]:
            dv = DataValidation(type="list", formula1='"' + ",".join(c["options"]) + '"', allow_blank=not c["req"],
                                showErrorMessage=True, errorTitle="قيمة غير مسموحة", error="يرجى الاختيار من القائمة")
            ws.add_data_validation(dv)
            dv.add(f"{get_column_letter(j)}3:{get_column_letter(j)}5000")
        elif c["kind"] == "number":
            dv = DataValidation(type="decimal", operator="greaterThanOrEqual", formula1="0", allow_blank=not c["req"],
                                showErrorMessage=True, error="يجب إدخال رقم موجب")
            ws.add_data_validation(dv)
            dv.add(f"{get_column_letter(j)}3:{get_column_letter(j)}5000")
        elif c["kind"] == "date":
            dv = DataValidation(type="date", operator="greaterThan", formula1="36526", allow_blank=not c["req"],
                                showErrorMessage=True, error="يجب إدخال تاريخ بصيغة يوم/شهر/سنة")
            ws.add_data_validation(dv)
            dv.add(f"{get_column_letter(j)}3:{get_column_letter(j)}5000")
            for r in range(3, 300):
                ws.cell(row=r, column=j).number_format = "dd/mm/yyyy"
    ws.row_dimensions[1].height = 34
    ws.freeze_panes = "A3"
    # نسخة من صفوف المثال في _meta — الـ parser بيتجاهل أي صف مطابق لها بالظبط (لو المستخدم نسي يمسحها)
    if examples:
        if not hasattr(wb, "_examples"):
            wb._examples = {}
        wb._examples[title] = [["" if v is None else str(v) for v in ex] for ex in examples]
    for i, ex in enumerate(examples):
        for j, v in enumerate(ex, 1):
            cell = ws.cell(row=3 + i, column=j, value=v)
            cell.font = Font(name=FONT, size=10, color="55555F", bold=(3 + i) in group_rows)
            cell.fill = GROUP_FILL if (3 + i) in group_rows else EX_FILL
            cell.border = BORDER
    return ws


def add_kv_sheet(wb, title, fields):
    """شيت بيانات رأس (مفتاح/قيمة) — للعقد وأمر التكليف"""
    ws = wb.create_sheet(title)
    ws.sheet_view.rightToLeft = True
    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 40
    ws.column_dimensions["C"].width = 22
    ws.column_dimensions["D"].width = 50
    for j, h in enumerate(["البيان", "القيمة", "(المفتاح)", "ملاحظات"], 1):
        c = ws.cell(row=1, column=j, value=h)
        c.font = Font(name=FONT, bold=True, color="FFFFFF")
        c.fill = HDR_FILL
        c.alignment = Alignment(horizontal="center")
    for i, (key, label, example, req, hint) in enumerate(fields, 2):
        ws.cell(row=i, column=1, value=f"{label}{' *' if req else ''}").font = Font(name=FONT, bold=req)
        v = ws.cell(row=i, column=2, value=example)
        v.fill = EX_FILL
        v.font = Font(name=FONT, color="55555F")
        ws.cell(row=i, column=3, value=key).font = Font(name="Consolas", size=9, color="71717F")
        ws.cell(row=i, column=4, value=hint).font = Font(name=FONT, size=9, color="71717F")
        for j in range(1, 5):
            ws.cell(row=i, column=j).border = BORDER
    return ws


def finish(wb, template_id, title, purpose, who, rules):
    ws = wb.create_sheet("تعليمات")
    ws.sheet_view.rightToLeft = True
    ws.column_dimensions["A"].width = 110
    lines = [(title, Font(name=FONT, bold=True, size=16, color=PURPLE)),
             (f"الغرض: {purpose}", Font(name=FONT, size=11)),
             (f"الجهة المسؤولة عن الرفع: {who}", Font(name=FONT, size=11)),
             ("", None),
             ("قواعد تعبئة البيانات", Font(name=FONT, bold=True, size=12, color=PURPLE))]
    lines += [(f"• {r}", Font(name=FONT, size=11)) for r in rules]
    lines += [("", None),
              ("قواعد عامة لجميع النماذج", Font(name=FONT, bold=True, size=12, color=PURPLE)),
              ("• لا يجوز تغيير أسماء أوراق العمل أو ترتيب الأعمدة أو الصف الثاني (الاسم التقني للعمود).", Font(name=FONT)),
              ("• العمود المميز بعلامة * إلزامي، ويجب الاختيار من القائمة في الأعمدة التي تتضمن قائمة اختيار.", Font(name=FONT)),
              ("• الصفوف الرمادية أمثلة توضيحية — يرجى حذفها قبل الرفع.", Font(name=FONT)),
              ("• تُدخل الأرقام دون فواصل أو رمز عملة، والتواريخ بصيغة يوم/شهر/سنة.", Font(name=FONT)),
              ("• عند الرفع تعرض المنظومة نتيجة المراجعة لكل صف وأخطاءه قبل الحفظ — ولا يُحفظ أي سجل قبل «اعتماد الاستيراد».", Font(name=FONT)),
              (f"• إصدار النموذج: {VERSION} — إذا كان النموذج قديماً ستطلب المنظومة تحميل الإصدار الأحدث.", Font(name=FONT, color="71717F"))]
    hints = getattr(wb, "_hints", [])
    if hints:
        lines += [("", None), ("إيضاح الأعمدة", Font(name=FONT, bold=True, size=12, color=PURPLE))]
        lines += [(f"• [{sheet}] {label}: {hint}", Font(name=FONT, size=11)) for sheet, label, hint in hints]
    for i, (t, f) in enumerate(lines, 1):
        c = ws.cell(row=i, column=1, value=t)
        if f:
            c.font = f
        c.alignment = Alignment(wrap_text=True, vertical="top")
    meta = wb.create_sheet("_meta")
    meta["A1"], meta["B1"] = "template_id", template_id
    meta["A2"], meta["B2"] = "version", VERSION
    meta["A3"], meta["B3"] = "examples", json.dumps(getattr(wb, "_examples", {}), ensure_ascii=False)
    meta.sheet_state = "hidden"
    del wb[wb.sheetnames[0]]  # الشيت الافتراضي الفاضي
    path = os.path.join(OUT, f"{template_id}.xlsx")
    wb.save(path)
    print("built", path)


# ═════════════ 01 الهيكل التنظيمي ═════════════
wb = Workbook()
add_sheet(wb, "رئاسات القطاعات", [col("code", "كود الرئاسة", 16, True, "كود مختصر فريد، مثال: PR-DELTA"), col("name", "اسم رئاسة القطاعات", 40, True)],
          [("PR-DELTA", "رئاسة قطاعات الدلتا والقناة")])
add_sheet(wb, "القطاعات", [col("code", "كود القطاع", 16, True), col("presidency_code", "كود الرئاسة", 16, True, "من ورقة عمل رئاسات القطاعات"), col("name", "اسم القطاع", 40, True)],
          [("S-EAST", "PR-DELTA", "المنطقة الشرقية")])
add_sheet(wb, "الإدارات العامة", [col("code", "كود الإدارة العامة", 18, True), col("sector_code", "كود القطاع", 16, True), col("name", "اسم الإدارة العامة", 44, True), col("gm_email", "البريد الإلكتروني للمدير العام", 28, hint="اختياري — يُربط بحساب المستخدم")],
          [("G-SINAI", "S-EAST", "الإدارة العامة لمناطق شمال سيناء", "gm.sinai@te.eg")])
add_sheet(wb, "الشئون الفنية", [col("code", "كود الشئون الفنية", 18, True), col("sector_code", "كود القطاع", 16, True), col("name", "الاسم", 40, True)],
          [("TA-EAST", "S-EAST", "الشئون الفنية — المنطقة الشرقية")])
add_sheet(wb, "الإدارات المختصة", [col("code", "كود الإدارة المختصة", 18, True), col("gdept_code", "كود الإدارة العامة", 18, True), col("name", "اسم الإدارة المختصة", 44, True)],
          [("D-ARISH", "G-SINAI", "إدارة تنفيذ العريش")])
add_sheet(wb, "السنترالات", [col("code", "كود السنترال", 16, True), col("dept_code", "كود الإدارة المختصة", 18, True), col("name", "اسم السنترال", 36, True)],
          [("C-RABAA", "D-ARISH", "سنترال رابعة")])
finish(wb, "01_الهيكل_التنظيمي", "نموذج الهيكل التنظيمي", "تعريف رئاسات القطاعات والقطاعات والإدارات العامة والشئون الفنية والإدارات المختصة والسنترالات.",
       "مدير النظام (Admin).", ["يرجى التعبئة من ورقة العمل الأولى حتى الأخيرة — يُشار في كل مستوى إلى كود المستوى الأعلى منه.",
                                "الكود فريد ولا يتغير بعد الرفع (يمكن تعديل الاسم).",
                                "عند رفع كيان مسجل بالكود نفسه، تُحدِّث المنظومة الاسم فقط."])

# ═════════════ 02 المشروعات ═════════════
wb = Workbook()
add_sheet(wb, "أنواع المشروعات", [col("code", "كود النوع", 16, True), col("name", "نوع المشروع", 36, True)],
          [("FIBERIZATION", "Fiberization"), ("ACCESS", "إتاحة")])
add_sheet(wb, "أنواع الأعمال", [col("code", "كود نوع الأعمال", 16, True), col("name", "نوع الأعمال", 36, True),
                                col("is_planning", "مستخلص تخطيط؟", 16, hint="نعم = يُسدَّد بنسبة 100% بعد الانتهاء دون مبالغ محتجزة لخرائط As-Built أو للاستلام الابتدائي", options=["نعم", "لا"])],
          [("CIVIL_MAINT", "صيانة مدني", "لا")])
add_sheet(wb, "المشروعات", [col("code", "كود المشروع", 16, True), col("name", "اسم المشروع / المنطقة", 44, True), col("type_code", "كود النوع", 14, True),
                            col("central_code", "كود السنترال", 16, True), col("start_date", "تاريخ البدء", 14, kind="date"), col("notes", "ملاحظات", 30)],
          [("PJ-RABAA", "حى الحدق — سنترال رابعة", "FIBERIZATION", "C-RABAA", None, "")])
finish(wb, "02_المشروعات", "نموذج المشروعات", "تعريف أنواع المشروعات وأنواع الأعمال والمشروعات وربط كل مشروع بالسنترال.", "مدير النظام أو الشئون الفنية.",
       ["يرتبط المشروع بسنترال واحد، تحدد المنظومة من خلاله الإدارة المختصة والإدارة العامة والقطاع ورئاسة القطاعات.",
        "يحدد نوع المشروع المستندات الإلزامية في المستخلص.",
        "ورقة عمل أنواع الأعمال اختيارية — الأنواع الأساسية مسجلة في المنظومة، ويمكن إضافة غيرها هنا أو من شاشة الهيكل التنظيمي."])

# ═════════════ 03 الشركات ═════════════
wb = Workbook()
add_sheet(wb, "الشركات", [col("code", "كود الشركة المنفذة", 14, True), col("name", "الاسم المختصر", 18, True), col("full_name", "الاسم الكامل", 40, True),
                          col("commercial_reg", "السجل التجاري", 16), col("tax_no", "البطاقة الضريبية", 16), col("email", "البريد الإلكتروني للمستخلصات", 28, True),
                          col("phone", "رقم الهاتف", 16), col("address", "العنوان", 36)],
          [("CO-BRIDGE", "بريدج", "شركة بريدج للهندسة والمقاولات", "", "", "invoices@bridge.com", "", "")])
finish(wb, "03_الشركات", "نموذج الشركات المنفذة", "تعريف الشركات المنفذة (المقاولين).", "مدير النظام.", ["يُرسل إلى هذا البريد الإلكتروني تنبيه السداد وجاهزية الشيك."])

# ═════════════ 04 المستخدمين ═════════════
wb = Workbook()
add_sheet(wb, "المستخدمين", [col("name", "الاسم", 28, True), col("email", "البريد الإلكتروني", 30, True, "يُستخدم لتسجيل الدخول واستلام التنبيهات"), col("phone", "رقم الهاتف المحمول", 16),
                             col("role", "الدور الوظيفي", 18, True, "admin, pmo, company, supervisor, exec_mgr, gm, tech_affairs, tech_office, planning, sector_head, presidency_head, committee, stores, finance", ROLES),
                             col("scope_type", "نوع نطاق الصلاحية", 14, True, "all = جميع الجهات", SCOPES), col("scope_code", "كود النطاق", 18, hint="كود الشركة المنفذة/رئاسة القطاعات/القطاع/الإدارة/السنترال حسب نوع نطاق الصلاحية"),
                             col("delegate_email", "البريد الإلكتروني للبديل", 28, hint="المستخدم البديل خلال فترات الإجازة")],
          [("م. محمد عليوة", "exec.arish@te.eg", "", "exec_mgr", "dept", "D-ARISH", ""), ("مسؤول مستخلصات بريدج", "invoices@bridge.com", "", "company", "company", "CO-BRIDGE", "")])
finish(wb, "04_المستخدمين", "نموذج المستخدمين والصلاحيات", "إنشاء حسابات المستخدمين مع الدور الوظيفي ونطاق الصلاحية.", "مدير النظام.",
       ["تُرسل إلى كل مستخدم دعوة بالبريد الإلكتروني لتعيين كلمة المرور.", "يحدد نطاق الصلاحية البيانات التي يطّلع عليها المستخدم: مدير التنفيذ = إدارته المختصة، والمدير العام = إدارته العامة، وهكذا.",
        "يمكن تكرار البريد الإلكتروني نفسه في أكثر من صف إذا كان للمستخدم أكثر من نطاق صلاحية."])

# ═════════════ 05 العقد والمقايسة ═════════════
wb = Workbook()
add_kv_sheet(wb, "بيانات العقد", [
    ("contract_no", "رقم العقد / الإحالة", "232/2025/1/36", True, "كما ورد في برقية القبول"),
    ("company_code", "كود الشركة المنفذة", "CO-BRIDGE", True, "من نموذج الشركات المنفذة"),
    ("title", "موضوع العقد", "التعاقد الخاص بتنفيذ شبكات FTTx الاتفاقي", True, ""),
    ("award_date", "تاريخ برقية القبول", "", False, ""),
    ("start_date", "تاريخ البدء", "", False, ""), ("end_date", "تاريخ الانتهاء", "", False, ""),
    ("currency", "العملة", "EGP", True, "EGP / USD / EUR"),
    ("vat_pct", "ضريبة القيمة المضافة %", 14, True, ""),
    # ── جدول الدفع (من برقية القبول / أوامر التكليف) — مجموع النسب = 100 ──
    ("pay_monthly_pct", "نسبة السداد مع المستخلص الشهري %", 70, True, "232: 70% — 231: 90%"),
    ("pay_asbuilt_pct", "نسبة محتجزة لحين تسليم خرائط ما بعد التنفيذ (As-Built) %", 20, False, "232: 20% — 231: 0"),
    ("pay_handover_pct", "نسبة محتجزة لحين الاستلام الابتدائي %", 10, False, "232 و 231: 10%"),
    ("planning_pay_pct", "نسبة سداد أعمال التخطيط %", 100, False, "تُسدَّد أعمال التخطيط بنسبة 100% بعد الانتهاء منها"),
    ("final_guarantee_pct", "خطاب الضمان النهائي % من قيمة أمر التكليف", 5, False, "يُقدَّم مع كل أمر تكليف"),
    ("delay_fine_pct_week", "غرامة التأخير % لكل أسبوع", 2, False, "231: 2% أسبوعياً"),
    ("delay_fine_cap_pct", "الحد الأقصى للغرامة %", 10, False, "من قيمة الأعمال المتأخرة"),
    ("warranty_months", "مدة الضمان الفني (شهور)", 12, False, ""),
    ("out_of_scope_uplift", "علاوة خارج النطاق", "5% / 10% / 15% سيناء", False, "حتى 25% (أو حسب ملحق البرقية)"),
    ("stamp_engineering_pct", "دمغة المهن الهندسية % (على أمر التكليف)", 0.3, False, "تُسدَّد مرة واحدة مع أمر التكليف"),
    ("stamp_applied_arts_pct", "دمغة مصممي الفنون التطبيقية %", 0.3, False, ""),
    ("stamp_construction_pct", "دمغة التشييد والبناء %", 0.05, False, ""),
    ("tax_pct", "خصم ضريبي من المنبع %", "", False, "تحدده الإدارة المالية"),
    ("retention_pct", "تأمين ضمان أعمال إضافي % (إن وُجد)", 0, False, "لا تتضمنه العقود الحالية — الضمان بخطاب الضمان النهائي"),
    ("advance_pct", "الدفعة المقدمة % (إن وُجدت)", 0, False, "لا تتضمن العقود الحالية دفعة مقدمة"),
    ("contract_value", "قيمة العقد (بعد آخر ملحق)", "", False, "إذا تُركت فارغة تُحتسب من جدول الكميات والأسعار"),
])
add_sheet(wb, "المقايسة", [col("item_code", "رقم البند", 14, True, "بالتدرج: 1-1-1-1 — صفوف العناوين بدون وحدة"), col("description", "وصف البند", 60, True),
                           col("unit", "الوحدة", 10, hint="فارغ = صف عنوان (مجموعة)"), col("contract_qty", "الكمية التعاقدية", 12, kind="number"),
                           col("unit_price", "سعر الوحدة", 14, kind="number", hint="فارغ أو صفر = البند غير مُسعّر في العقد (أي فوترة عليه تُصنَّف ضمن الفئة C5)"),
                           col("work_type", "نوع العمل", 16, options=["أعمال مدنية", "تركيبات", "كهربية", "توريد", "توريد وتركيب", "تخطيط ورسومات", "خدمات", "صيانة"])],
          [("1", "الإعمال المدنيــة", "", "", "", ""), ("1-1", "غرف التفتيش", "", "", "", ""), ("1-1-1-2", "غرفة تفتيش طراز HH-I", "عدد", 180, 26000, "أعمال مدنية"),
           ("1-9-1", "حفر ضيق Micro trenching عرض 10 إلى 13 سم", "م.ط", 50000, 0, "أعمال مدنية"), ("2-4-7", "pulling of HDPE Single Microduct", "م.ط", 80000, 0, "تركيبات")],
          group_rows=(3, 4))
finish(wb, "05_العقد_والمقايسة", "نموذج العقد وجدول الكميات والأسعار", "تعريف العقد وبنوده وأسعاره — وهي الأسعار التي تحتسب بها المنظومة جميع المستخلصات.",
       "الشئون الفنية.", ["يُكتب رقم البند بالشرطة (1-1-1-1) أو بالنقطة (1.1.1.1) — وتوحّد المنظومة الصيغتين.",
                         "يُعامَل الصف الذي لا يتضمن وحدة كعنوان مجموعة، ولا تجوز الفوترة عليه.",
                         "يمكن نسخ المقايسة المعتمدة كما هي في ورقة عمل المقايسة (بترتيب الأعمدة نفسه: مسلسل، البيان، الوحدة، الكمية، سعر الوحدة)."])

# ═════════════ 06 أمر التكليف ═════════════
wb = Workbook()
add_kv_sheet(wb, "بيانات أمر التكليف", [
    ("contract_no", "رقم العقد", "232/2025/1/36", True, ""), ("ao_no", "رقم أمر التكليف", "PO25", True, "PO25 أو 25"),
    ("revision", "رقم ملحق أمر التكليف", 0, False, "0 = أمر التكليف الأصلي، 1 = ملحق الزيادة الأول ..."),
    ("ao_date", "تاريخ أمر التكليف", "", True, ""), ("project_code", "كود المشروع", "PJ-OCT1", True, "من نموذج المشروعات"),
    ("name", "اسم أمر التكليف / المنطقة", "أكتوبر 1 — الحي الثاني", True, ""), ("ao_value", "قيمة أمر التكليف (غير شامل الضريبة)", "", False, "إذا تُركت فارغة تُحتسب من الكميات × أسعار العقد"),
    ("increase_value", "قيمة الزيادة في الملحق", "", False, "للملاحق فقط"),
    ("financial_commitment", "الارتباط المالي المعتمد", "", False, "قد يقل عن قيمة أمر التكليف — ولا يجوز أن تتجاوزه المستخلصات دون تعزيز الارتباط المالي"),
    ("planning_annex_value", "ملحق التخطيط / خرائط ما بعد التنفيذ", "", False, "يُسدَّد بنسبة 100% بعد الانتهاء"),
    ("area", "النطاق الجغرافي / المنطقة", "", False, ""), ("central", "السنترال", "", False, ""),
    ("out_of_scope", "خارج النطاق؟", "", False, "نعم / لا — في حال «نعم» تُطبَّق علاوة خارج النطاق"),
    ("duration", "مدة التنفيذ", "", False, ""),
    ("final_guarantee_pct", "خطاب الضمان النهائي %", 5, False, ""),
    ("stamps_total", "إجمالي رسوم الدمغة المسددة", "", False, ""),
])
add_sheet(wb, "بنود أمر التكليف", [col("item_code", "رقم البند", 14, True, "يجب أن يكون مدرجاً في جدول كميات العقد"), col("description", "الوصف (للمراجعة فقط)", 50, hint="يُستمد من العقد — ولا يُقرأ من هذا العمود"),
                                   col("site_code", "كود الموقع / الكابينة", 16, hint="اختياري: #75 — في حال توزيع الكميات على مواقع"), col("planned_qty", "الكمية المخططة", 14, True, kind="number")],
          [("1-7-2", "الحفر للشبكة الثانوية", "#75", 133.77), ("1-9-1", "حفر ضيق Micro trenching", "#75", 1292)])
add_sheet(wb, "مهمات أمر التكليف", [col("material_code", "رقم الشطب / كود الصنف", 18, True), col("description", "الوصف (للمراجعة فقط)", 40), col("planned_qty", "الكمية المخططة", 14, True, kind="number")],
          [("1.1.7", "48 FIBER OPTIC CABLE", 12.5)])
finish(wb, "06_أمر_التكليف", "نموذج أمر التكليف", "تعريف أمر التكليف وكمياته المخططة لكل بند (ولكل موقع إن وُجد) والمهمات المخططة.",
       "الشئون الفنية.", ["يرتبط أمر التكليف بمشروع، يتحدد من خلاله السنترال والإدارة والقطاع.",
                         "يُرفع ملحق أمر التكليف بالنموذج نفسه مع رقم الملحق — وتحتفظ المنظومة بالقيمة الأصلية والزيادة.",
                         "إذا كانت الكميات موزعة في أعمدة لكل موقع (#75، #76...) كما في ملفات الزيادة، يرجى إدراج كل موقع في صف مستقل مع كود الموقع."])

# ═════════════ 07 كتالوج المهمات ═════════════
wb = Workbook()
add_sheet(wb, "المهمات", [col("material_code", "رقم الشطب / كود الصنف", 18, True), col("description", "الوصف", 50, True), col("unit", "الوحدة", 10, True),
                          col("supplied_by", "جهة التوريد", 18, options=["المصرية للاتصالات", "الشركة المنفذة"]), col("group", "المجموعة", 26)],
          [("1.1.7", "48 FIBER OPTIC CABLE", "KM", "المصرية للاتصالات", "Supply of F.O. Cables")])
finish(wb, "07_كتالوج_المهمات", "نموذج كتالوج المهمات", "تعريف أصناف المهمات (رقم الشطب) المنصرفة من المخازن.", "المخازن والمشتريات.",
       ["رقم الشطب فريد على مستوى المنظومة."])

# ═════════════ 08 المنصرف من المخازن ═════════════
wb = Workbook()
add_sheet(wb, "المنصرف", [col("contract_no", "رقم العقد", 16, True), col("ao_no", "رقم أمر التكليف", 14, True), col("material_code", "رقم الشطب", 16, True),
                          col("qty", "الكمية المنصرفة", 14, True, kind="number"), col("issue_date", "تاريخ الصرف", 14, True, kind="date"),
                          col("issue_ref", "رقم إذن الصرف", 16, True), col("returned_qty", "الكمية المُعادة للمخازن", 14, kind="number", hint="في حال إعادة المقاول جزءاً من المهمات إلى المخازن")],
          [("232/2025/1/36", "PO25", "1.1.7", 6, None, "إذن 4512", "")])
finish(wb, "08_المنصرف_من_المخازن", "نموذج المنصرف من المخازن", "تسجيل المهمات المنصرفة لكل أمر تكليف — وتُقارن بالكميات المخططة والمنفذة والمفوترة.",
       "المخازن والمشتريات.", ["يُسجَّل كل إذن صرف في صف مستقل، وتُسجَّل الكمية المُعادة للمخازن في الصف نفسه أو في صف جديد."])

# ═════════════ 09 بنود المستخلص (الشركة) ═════════════
wb = Workbook()
add_sheet(wb, "بنود المستخلص", [col("item_code", "رقم البند", 14, True, "وفق جدول كميات العقد"), col("description", "وصف البند (اختياري)", 50, hint="للمراجعة فقط — تستمد المنظومة الوصف من العقد"),
                                col("unit", "الوحدة (اختياري)", 10), col("qty", "الكمية المطلوب فوترتها", 16, True, kind="number", hint="كمية هذا المستخلص فقط، وليست الكمية التراكمية"),
                                col("site_code", "كود الموقع", 14, hint="اختياري"), col("notes", "ملاحظات", 30)],
          [("1-1-1-2", "غرفة تفتيش طراز HH-I", "عدد", 2, "#75", ""), ("1-9-1", "حفر ضيق Micro trenching", "م.ط", 1292, "#75", "")])
finish(wb, "09_بنود_المستخلص", "نموذج بنود المستخلص", "بنود الأعمال المطلوب فوترتها في المستخلص.", "المقاول (الشركة المنفذة).",
       ["لا يتضمن النموذج عمود سعر — يُستمد السعر من العقد ويُحتسب الإجمالي تلقائياً.",
        "تضيف المنظومة الكميات السابقة وتقارن الكمية التراكمية بأمر التكليف وتقترح فئة التجاوز.",
        "في حال وجود بند غير مدرج في العقد، يُكتب بكود يبدأ بـ N (مثال: N-1) مع الوصف والوحدة — ويُصنَّف ضمن الفئة C5 ويُحال إلى مرحلة التسعير."])

# ═════════════ 10 مهمات المستخلص (الشركة) ═════════════
wb = Workbook()
add_sheet(wb, "مهمات المستخلص", [col("material_code", "رقم الشطب", 16, True), col("description", "الوصف (اختياري)", 44), col("unit", "الوحدة (اختياري)", 10),
                                 col("executed_qty", "الكمية المنفذة", 14, True, kind="number", hint="الكمية المركبة فعلياً في هذا المستخلص — وهي الكمية المفوترة"),
                                 col("notes", "ملاحظات", 30)],
          [("1.1.7", "48 FIBER OPTIC CABLE", "KM", 2.35, "")])
finish(wb, "10_مهمات_المستخلص", "نموذج مهمات المستخلص", "المهمات المرتبطة بأعمال المستخلص.", "المقاول (الشركة المنفذة).",
       ["تقارن المنظومة لكل رقم شطب: الكمية المخططة في أمر التكليف ↔ المنصرف من المخازن ↔ الكمية المنفذة التراكمية ↔ الكمية المفوترة.",
        "إذا تجاوزت الكمية المنفذة المنصرف من المخازن تُميِّز المنظومة الصف باللون الأحمر."])

# ═════════════ 11 المستخلصات السابقة (ترحيل) ═════════════
wb = Workbook()
add_sheet(wb, "المستخلصات", [col("contract_no", "رقم العقد", 16, True), col("ao_no", "رقم أمر التكليف", 12, True), col("invoice_no", "رقم المستخلص", 12, True),
                             col("path_name", "اسم المسار / المنطقة", 40, True), col("amount_excl_vat", "المبلغ غير شامل الضريبة", 16, True, kind="number"),
                             col("amount_incl_vat", "المبلغ شامل الضريبة", 16, kind="number"),
                             col("current_step", "مرحلة الاعتماد الحالية", 18, True, options=["المقاول", "مشرف التنفيذ", "مدير التنفيذ", "المدير العام", "الشئون الفنية", "التخطيط", "رئيس القطاع", "المخازن والمشتريات", "الإدارة المالية", "تم السداد", "بانتظار أمر التكليف"]),
                             col("since_date", "في المرحلة منذ تاريخ", 16, kind="date"), col("holder_name", "الجهة الحالية (الاسم)", 22), col("payment_ref", "رقم الشيك/التحويل", 16), col("notes", "ملاحظات", 30)],
          [("232/2025/1/36", "PO01", "8", "حى الحدق - سنترال رابعة / 6 كبائن", 3027947.36, 3451859.98, "تم السداد", None, "", "", "")])
finish(wb, "11_المستخلصات_السابقة", "نموذج ترحيل بيانات المستخلصات الحالية", "إدخال المستخلصات القائمة قبل تشغيل المنظومة (من ملفات الموقف).",
       "مكتب إدارة المشروعات (PMO) — مرة واحدة عند بدء التشغيل.", ["تظهر المستخلصات المُرحَّلة بعلامة \"مُرحَّل\" دون بنود تفصيلية.", "يُستخدم تاريخ دخول المرحلة لضبط بداية احتساب المدة المستهدفة (SLA).",
        "يُستدل على نوع الأعمال من اسم المسار: كهرب ← أعمال كهربية، تخطيط ← تخطيط ورسومات، صيانة ← صيانة مدني، متكامل ← أعمال متكاملة، وفيما عدا ذلك أعمال مدنية."])

# ═════════════ 12 الأجازات الرسمية ═════════════
wb = Workbook()
add_sheet(wb, "الأجازات", [col("date", "التاريخ", 14, True, kind="date"), col("name", "المناسبة", 30, True)], [(None, "عيد العمال")])
finish(wb, "12_الأجازات_الرسمية", "نموذج العطلات الرسمية", "الأيام غير المحتسبة ضمن المدة المستهدفة (SLA)، بالإضافة إلى يومي الجمعة والسبت.", "مكتب إدارة المشروعات (PMO).", ["يُسجَّل كل يوم في صف مستقل."])

print("done")
