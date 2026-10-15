"""
extract_boq_pdfs.py — يطلّع كميات البنود من ملفات "قائمة أعمال / مقايسة" الـ PDF الرقمية (مش الممسوحة).
التشغيل:  python -I scripts/extract_boq_pdfs.py "Example Data" data-import
الناتج:
  data-import/ao_items_from_pdf.csv   — contract_no, ao_no, source_file, site_code, item_code, qty, unit_price, total
  data-import/boq_pdfs_report.csv     — ملف ← أمر التكليف المستنتج، عدد البنود، الإجمالي، ملاحظات
ربط الملف بأمر التكليف من اسم الفولدر/الملف (#15، PO 25، امر تكليف 25، PO06 BOQ ...) —
الملفات اللي مش واضحة بتطلع بـ ao_no فاضي في التقرير عشان تتراجع يدوي.
"""
import csv
import glob
import os
import re
import sys

import pymupdf

sys.stdout.reconfigure(encoding="utf-8")
SRC = sys.argv[1] if len(sys.argv) > 1 else "Example Data"
OUT = sys.argv[2] if len(sys.argv) > 2 else "data-import"
CODE = re.compile(r"^\d+(?:[-.]\d+)*$")


def num(s):
    s = (s or "").replace(",", "").replace("\n", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def contract_of(path):
    if "231" in path and "2026" in path:
        return "231/2026/1/12"
    if "232" in path:
        return "232/2025/1/36"
    return ""


def aos_of(path):
    """أرقام أوامر التكليف من المسار — الملف الأقرب أولاً"""
    name = os.path.basename(path)
    folder = os.path.basename(os.path.dirname(path))
    for text in (name, folder):
        found = re.findall(r"(?:PO\s*#?\s*|#\s*|امر تكليف\s*|أمر تكليف\s*|تكليف\s*#?\s*)(\d{1,2})(?!\d)", text, flags=re.I)
        found += re.findall(r"PO(\d{2})", text)
        if found:
            out = []
            for f in found:
                v = f"PO{int(f):02d}"
                if v not in out:
                    out.append(v)
            return out
    return []


def header_map(row):
    """بيرجع أعمدة الكمية/السعر/الإجمالي/المواقع من صف العناوين (النص العربي ممكن يطلع معكوس)"""
    cols = {"code": None, "qty": [], "price": None, "total": None, "sites": []}
    for j, c in enumerate(row):
        t = (c or "").replace("\n", " ")
        r = t[::-1]
        if "مسلسل" in t or "مسلسل" in r:
            cols["code"] = j
        elif any(k in t or k in r for k in ("الكمية", "الكميه")):
            cols["qty"].append(j)
        elif "سعر" in t or "سعر" in r:
            cols["price"] = j
        elif any(k in t or k in r for k in ("الإجمالي", "الاجمالي", "الإجمال", "لامجلاإ")):
            cols["total"] = j
        elif "#" in t:
            cols["sites"].append((j, t.strip()))
    return cols


def parse_pdf(path):
    d = pymupdf.open(path)
    items, hdr = [], None
    for pg in d:
        try:
            tabs = pg.find_tables().tables
        except Exception:
            continue
        for t in tabs:
            for row in t.extract():
                cells = [(c or "").strip() for c in row]
                if any(("مسلسل" in c or "لسلسم" in c) for c in cells):
                    hdr = header_map(cells)
                    continue
                if not hdr or hdr["code"] is None or hdr["code"] >= len(cells):
                    continue
                code_idx = hdr["code"]
                if not CODE.match(cells[code_idx].replace(" ", "")):
                    continue
                code = cells[code_idx].replace(".", "-").replace(" ", "")
                price = num(cells[hdr["price"]]) if hdr["price"] is not None and hdr["price"] < len(cells) else None
                total = num(cells[hdr["total"]]) if hdr["total"] is not None and hdr["total"] < len(cells) else None
                if hdr["sites"]:
                    for j, s in hdr["sites"]:
                        q = num(cells[j]) if j < len(cells) else None
                        if q:
                            items.append((s, code, q, price, q * price if price else None))
                else:
                    q = None
                    for j in hdr["qty"]:
                        if j < len(cells) and num(cells[j]):
                            q = num(cells[j])
                            break
                    if q:
                        items.append(("", code, q, price, total))
    return items


def main():
    rows, report = [], []
    for p in sorted(glob.glob(os.path.join(SRC, "**", "*.pdf"), recursive=True)):
        name = os.path.basename(p)
        if not any(k in name for k in ("قائمة", "مقايسة", "BOQ", "كميات", "اعمال", "أعمال", "تكليف شركة")):
            continue
        d = pymupdf.open(p)
        if sum(len(pg.get_text().strip()) for pg in d) < 500:
            report.append((name, contract_of(p), "", 0, 0, "ممسوح ضوئي — مفيش نص"))
            continue
        items = parse_pdf(p)
        aos = aos_of(p)
        ao = aos[0] if len(aos) == 1 else ""
        note = "" if ao else ("أكتر من أمر تكليف في الاسم: " + "، ".join(aos) if aos else "مش واضح أمر التكليف من المسار")
        if "عقد 26" in name or "مقايسة أكتوبر معتمدة" in name:
            ao, note = "", "مقايسة العقد نفسه (مش أمر تكليف)"
        total = sum((t or (q * (pr or 0))) for _, _, q, pr, t in items)
        report.append((name, contract_of(p), ao, len(items), round(total, 2), note))
        for s, code, q, pr, t in items:
            rows.append((contract_of(p), ao, name, s, code, q, pr if pr is not None else "", round(t, 2) if t else ""))
    with open(os.path.join(OUT, "ao_items_from_pdf.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["contract_no", "ao_no", "source_file", "site_code", "item_code", "qty", "unit_price", "total"])
        w.writerows(rows)
    with open(os.path.join(OUT, "boq_pdfs_report.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["file", "contract_no", "ao_no", "items", "total_value", "note"])
        w.writerows(report)
    for r in report:
        print(f"{r[2] or '—':6} {r[1]:14} {r[3]:4} بند  {r[4]:>16,.2f}  {r[0][:55]}  {r[5]}")
    print("rows:", len(rows))


main()
