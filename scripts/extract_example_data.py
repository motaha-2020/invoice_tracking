"""
extract_example_data.py
يحوّل ملفات Excel الحقيقية في "Example Data" لملفات CSV بنفس شكل جداول قاعدة البيانات.
التشغيل:  python -I scripts/extract_example_data.py "Example Data" data-import
الناتج (UTF-8 with BOM عشان يفتح عربي في Excel):
  companies.csv, contracts.csv, contract_items.csv, assignment_orders.csv, ao_sites.csv,
  ao_items.csv, materials_catalog.csv, invoices_history.csv, _report.txt
"""
import csv
import glob
import os
import re
import sys
from collections import Counter, OrderedDict

import openpyxl

sys.stdout.reconfigure(encoding="utf-8")
SRC = sys.argv[1] if len(sys.argv) > 1 else "Example Data"
OUT = sys.argv[2] if len(sys.argv) > 2 else "data-import"
os.makedirs(OUT, exist_ok=True)
report = []


def log(msg):
    report.append(msg)
    print(msg)


def clean(v):
    if v is None:
        return ""
    return re.sub(r"\s+", " ", str(v)).strip()


def num(v):
    if v in (None, ""):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def find(pattern):
    hits = glob.glob(os.path.join(SRC, "**", pattern), recursive=True)
    return hits[0] if hits else None


def rows_of(path):
    ws = openpyxl.load_workbook(path, data_only=True, read_only=True).worksheets[0]
    return [r for r in ws.iter_rows(values_only=True)]


def write(name, header, rows):
    with open(os.path.join(OUT, name), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    log(f"  -> {name}: {len(rows)} rows")


CODE_RE = re.compile(r"^\d+(-\d+)*$")


def excel_serial_code(v):
    """Excel بيحوّل أكواد زي '5-5-2' و'5-6' لتواريخ ويخزنها كرقم مسلسل (37381، 45813).
    بنرجّعها كود: يوم-شهر[-سنة بخانتين لو السنة قبل 2010 = اتكتبت صريحة]."""
    import datetime
    if isinstance(v, (int, float)) and float(v).is_integer() and 30000 <= v <= 60000:
        d = datetime.date(1899, 12, 30) + datetime.timedelta(days=int(v))
        return f"{d.day}-{d.month}" + (f"-{d.year % 100}" if d.year < 2010 else "")
    return None


def norm_code(c):
    """'1-1-1-1' / '1.1.1' → '1-1-1-1'"""
    c = excel_serial_code(c) or clean(c).replace(".", "-")
    return c if CODE_RE.match(c) else None


def parent_of(code):
    return "-".join(code.split("-")[:-1]) if "-" in code else ""


# ───────────────────────── المقايسة (بنود العقد) ─────────────────────────
def parse_boq(path, qty_col=3, price_col=4):
    """بيرجع بنود متدرجة: عناوين (is_group) + بنود فعلية بوحدة وسعر"""
    items = OrderedDict()
    section = ""
    for r in rows_of(path):
        code = norm_code(r[0]) if r and r[0] is not None else None
        desc = clean(r[1]) if len(r) > 1 else ""
        if not code or not desc:
            continue
        unit = clean(r[2]) if len(r) > 2 else ""
        price = num(r[price_col]) if len(r) > price_col else None
        q = num(r[qty_col]) if len(r) > qty_col else None
        level = code.count("-") + 1
        if level == 1:
            section = desc
        is_group = not unit
        if code in items:  # أكواد مكررة في الملف — نضيف لاحقة
            code = f"{code}#{sum(1 for k in items if k.split('#')[0] == code)}"
        items[code] = dict(code=code, parent=parent_of(code.split("#")[0]), level=level, is_group=int(is_group),
                           description=desc, unit=unit, unit_price=price, qty=q, section=section)
    return items


companies = [("co-bridge", "بريدج", "شركة بريدج للهندسة والمقاولات")]
contracts = []
contract_items = []

boq231 = find("مقايسة بريدج عقد 26.xlsx")
boq232 = find("PO25 بريدج.xlsx")  # نفس قالب مقايسة عقد 232 بأسعاره
for no, path, title in [("231/2026/1/12", boq231, "تنفيذ شبكات FTTx (Fiberization) — الإحالة 231"),
                        ("232/2025/1/36", boq232, "التعاقد الخاص بتنفيذ شبكات FTTx الاتفاقي — 232")]:
    if not path:
        log(f"!! مقايسة العقد {no} مش موجودة")
        continue
    items = parse_boq(path)
    leaf = [i for i in items.values() if not i["is_group"]]
    no_price = [i for i in leaf if not i["unit_price"]]
    log(f"العقد {no}: {len(items)} صف ({len(leaf)} بند فعلي، {len(no_price)} بند بدون سعر) من {os.path.basename(path)}")
    contracts.append((no, "co-bridge", title, "EGP", 14, os.path.basename(path)))
    for i in items.values():
        contract_items.append((no, i["code"], i["parent"], i["level"], i["is_group"], i["section"], i["description"],
                               i["unit"], i["unit_price"] if i["unit_price"] is not None else "",
                               i["qty"] if (no.startswith("231") and i["qty"] is not None) else ""))

# ───────────────────────── أوامر التكليف + كمياتها ─────────────────────────
aos, ao_sites, ao_items = [], [], []
ao_listed_codes = set()  # كل الأكواد المكتوبة في ملف أمر التكليف حتى لو كميتها صفر
seen_ao = set()


def add_ao(contract_no, ao_no, name, source):
    key = (contract_no, ao_no)
    if key not in seen_ao:
        seen_ao.add(key)
        aos.append((contract_no, ao_no, name, source))


# أوامر تكليف ليها ملف كميات بعمود واحد (PO25, PO26)
for pattern, ao_no, name in [("PO25 بريدج.xlsx", "PO25", "أكتوبر 1 — الحي الثاني"),
                             ("PO26 قائمة أعمال أكتوبر2 - بريدج.xlsx", "PO26", "أكتوبر 2")]:
    p = find(pattern)
    if not p:
        continue
    add_ao("232/2025/1/36", ao_no, name, os.path.basename(p))
    n = 0
    for code, i in parse_boq(p).items():
        if not i["is_group"] and i["qty"]:
            ao_items.append(("232/2025/1/36", ao_no, "", code, i["qty"]))
            n += 1
    log(f"أمر التكليف {ao_no}: {n} بند بكميات")

# أمر تكليف بعد الزيادة — الكميات متقسمة على مواقع (#75, #76 ...)
p = find("PO25 بعد الزيادة*.xlsx")
if p:
    rows = rows_of(p)
    hdr_idx = next(i for i, r in enumerate(rows) if r and clean(r[0]) == "مسلسل")
    hdr = rows[hdr_idx]
    # أعمدة المواقع = من العمود 4 لحد أول عمود عنوانه فاضي (بعده: الكمية الإجمالي / سعر الوحدة / الإجمالي — مش مواقع)
    site_cols = []
    for j, h in enumerate(hdr):
        if j < 3:
            continue
        if not clean(h) or any(w in clean(h) for w in ("الإجمال", "الاجمال", "سعر", "الكمية")):
            break
        site_cols.append((j, clean(h)))
    add_ao("232/2025/1/36", "PO25-R1", "أكتوبر 1 — بعد الزيادة (ملحق)", os.path.basename(p))
    for _, s in site_cols:
        ao_sites.append(("232/2025/1/36", "PO25-R1", s))
    n = 0
    for r in rows[hdr_idx + 1:]:
        code = norm_code(r[0]) if r and r[0] is not None else None
        if not code or not clean(r[2]):
            continue
        ao_listed_codes.add(("232/2025/1/36", "PO25-R1", code))
        for j, s in site_cols:
            q = num(r[j]) if j < len(r) else None
            if q:
                ao_items.append(("232/2025/1/36", "PO25-R1", s, code, q))
                n += 1
    log(f"أمر التكليف PO25 بعد الزيادة: {len(site_cols)} موقع، {n} كمية (بند × موقع)")

# ───────────────────────── كتالوج المهمات (توريد المصرية) ─────────────────────────
materials = []
p = find("قائمة المهمات - أكتوبر.xlsx")
if p:
    for r in rows_of(p):
        code = clean(r[0]) if r and r[0] is not None else ""
        desc = clean(r[1]) if len(r) > 1 else ""
        if not re.match(r"^[A-Z]$|^\d+(\.\d+)*$", code) or not desc:
            continue
        # الكود متخزن كرقم عشري → 2.10 بيتقري 2.1 (بيتلخبط مع المجموعة 2.1). لو اللي قبله أخ بنفس الأب وآخره 9 → 10
        if isinstance(r[0], float) and materials and "." in code and "." in materials[-1][0]:
            prev = materials[-1][0]
            par, last = code.rsplit(".", 1)
            if prev.rsplit(".", 1)[0] == par and int(prev.rsplit(".", 1)[1]) + 1 == int(last) * 10:
                code = f"{par}.{int(last) * 10}"
        unit = clean(r[2]) if len(r) > 2 else ""
        note = clean(r[4]) if len(r) > 4 else ""
        materials.append((code, ".".join(code.split(".")[:-1]), int(not unit), desc, unit, note))
    log(f"كتالوج المهمات: {len(materials)} صف ({sum(1 for m in materials if not m[2])} صنف)")

# ───────────────────────── المستخلصات السابقة (ملفات الموقف) ─────────────────────────
STATUS_MAP = [  # (كلمة في الموقف، المحطة في المنظومة، الحالة)
    ("تم الصرف", "done", "paid"), ("منصرف", "done", "paid"),
    ("مخازن", "stores", "active"), ("المخازن", "stores", "active"),
    ("الشؤن الفنية", "tech", "active"), ("الشئون الفنية", "tech", "active"),
    ("مدير عام", "gm", "active"),
    ("مدير الإدارة", "exec", "active"), ("مدير إدارة التنفيذ", "exec", "active"),
    ("مشرف التنفيذ", "sup", "active"),
    ("امر التكليف", "company", "on_hold"), ("أمر التكليف", "company", "on_hold"),
    ("تقديري", "company", "draft"),
    ("تحت اليد", "company", "draft"), ("تحت القياس", "company", "draft"), ("جارى المراجعة والتعديل", "company", "draft"),
    ("توقيع الشهادات", "company", "draft"), ("شهادة الرئيسي", "company", "draft"), ("تخطيط", "company", "draft"),
    ("تم عمل الفاتورة", "sup", "active"),
]


def map_status(s):
    for k, step, st in STATUS_MAP:
        if k in s:
            return step, st
    return "unknown", "unknown"


invoices = []
unmapped = Counter()
for pattern, contract_no, cols in [("موقف أعمال مستخلصات - بريدج.xlsx", "232/2025/1/36", dict(ao=1, no=2, name=3, region=4, scope=5, ex=6, inc=7, st=8)),
                                   ("موقف مستخلصات بريدج -12-1-2026-231.xlsx", "231/2026/1/12", dict(ao=1, no=2, name=3, region=4, scope=None, ex=5, inc=6, st=7))]:
    p = find(pattern) or (os.path.join(SRC, pattern) if os.path.exists(os.path.join(SRC, pattern)) else None)
    if not p:
        continue
    rows = rows_of(p)
    start = next(i for i, r in enumerate(rows) if r and any(clean(c) == "م" for c in r[:2])) + 1
    n = 0
    for r in rows[start:]:
        no = clean(r[cols["no"]])
        if not no or not clean(r[cols["ao"]]):
            continue
        ao = clean(r[cols["ao"]]).replace(" ", "").upper()
        ao = ao if ao.startswith("PO") else f"PO{int(float(ao)):02d}" if re.match(r"^\d+(\.0)?$", ao) else ao
        status_raw = clean(r[cols["st"]])
        step, st = map_status(status_raw)
        if step == "unknown":
            unmapped[status_raw] += 1
        holder = re.search(r"\(\s*(?:د/|م/|م\.)?\s*([^)]+)\)?", status_raw)
        ex, inc = num(r[cols["ex"]]), num(r[cols["inc"]])
        invoices.append((contract_no, ao, no, clean(r[cols["name"]]), clean(r[cols["region"]]),
                         clean(r[cols["scope"]]) if cols["scope"] is not None else "",
                         round(ex, 2) if ex else "", round(inc, 2) if inc else "",
                         round(inc / ex * 100 - 100, 2) if ex and inc else "",
                         status_raw, step, st, holder.group(1).strip() if holder else ""))
        add_ao(contract_no, ao, "", "من ملف الموقف")
        n += 1
    log(f"موقف العقد {contract_no}: {n} مستخلص")
if unmapped:
    log("حالات محتاجة مراجعة يدوي (unknown): " + "; ".join(f"{k} ×{v}" for k, v in unmapped.items()))

# ───────────────────────── الكتابة ─────────────────────────
log("\nالملفات:")
write("companies.csv", ["id", "name", "full_name"], companies)
write("contracts.csv", ["contract_no", "company_id", "title", "currency", "vat_pct", "source_file"], contracts)
write("contract_items.csv", ["contract_no", "item_code", "parent_code", "level", "is_group", "section", "description", "unit", "unit_price", "contract_qty"], contract_items)
write("assignment_orders.csv", ["contract_no", "ao_no", "name", "source_file"], sorted(aos))
write("ao_sites.csv", ["contract_no", "ao_no", "site_code"], ao_sites)
write("ao_items.csv", ["contract_no", "ao_no", "site_code", "item_code", "planned_qty"], ao_items)
write("materials_catalog.csv", ["material_code", "parent_code", "is_group", "description", "unit", "note"], materials)
write("invoices_history.csv", ["contract_no", "ao_no", "invoice_no", "path_name", "region", "scope", "amount_excl_vat", "amount_incl_vat", "vat_pct_check", "status_raw", "mapped_step", "mapped_status", "holder_name"], invoices)

# فحص جودة: بنود في أوامر التكليف مش موجودة في المقايسة
codes = {(c[0], c[1]) for c in contract_items}
missing = sorted({(a[0], a[3]) for a in ao_items if (a[0], a[3]) not in codes})
if missing:
    log(f"!! {len(missing)} كود بند في أوامر التكليف مش موجود في مقايسة العقد: " + ", ".join(m[1] for m in missing[:15]))
listed_missing = sorted({(a[1], a[2]) for a in ao_listed_codes if (a[0], a[2]) not in codes} - {(a[1], a[3]) for a in ao_items})
if listed_missing:
    log(f"!! {len(listed_missing)} كود مكتوب في ملف أمر التكليف (بكمية صفر) ومش موجود في مقايسة العقد: "
        + ", ".join(f"{c} ({ao})" for ao, c in listed_missing))
with open(os.path.join(OUT, "_report.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(report))
