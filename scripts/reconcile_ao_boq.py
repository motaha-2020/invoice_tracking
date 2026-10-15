"""
reconcile_ao_boq.py — يربط ملفات قوائم الأعمال (ao_items_from_pdf.csv) بأوامر التكليف (ao_master.csv) بالقيمة:
  - لو إجمالي الملف = القيمة الأصلية أو الحالية لأمر تكليف في نفس العقد (فرق ≤ 1%) → الملف ده كميات أمر التكليف ده.
  - لو فيه أكتر من ملف لنفس أمر التكليف: الأقرب للقيمة الحالية (بعد الزيادة) هو المعتمد، والباقي "نسخة سابقة".
  - الملفات اللي مالهاش تطابق بتطلع في التقرير عشان تتراجع.
الناتج:
  data-import/ao_items_final.csv       — contract_no, ao_no, version(base|current), site_code, item_code, planned_qty, unit_price, source_file
  data-import/ao_boq_match_report.csv  — ملف ← أمر التكليف، طريقة الربط، الفرق، الحالة
التشغيل:  python -I scripts/reconcile_ao_boq.py data-import
"""
import csv
import os
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")
D = sys.argv[1] if len(sys.argv) > 1 else "data-import"
f2 = lambda v: float(v) if v not in ("", None) else 0.0

aos = list(csv.DictReader(open(os.path.join(D, "ao_master.csv"), encoding="utf-8-sig")))
items = list(csv.DictReader(open(os.path.join(D, "ao_items_from_pdf.csv"), encoding="utf-8-sig")))
by_file = defaultdict(list)
for r in items:
    by_file[(r["contract_no"], r["source_file"])].append(r)


def dedupe_blocks(rows):
    """نفس اسم الملف ممكن يكون في فولدرين — الصفوف بتتكرر بلوكات متطابقة، بناخد بلوك واحد"""
    key = lambda r: (r["site_code"], r["item_code"], r["qty"])
    for k in (3, 2):
        n = len(rows)
        if n % k == 0 and n:
            size = n // k
            if all([key(r) for r in rows[i * size:(i + 1) * size]] == [key(r) for r in rows[:size]] for i in range(k)):
                return rows[:size]
    return rows


for k in list(by_file):
    by_file[k] = dedupe_blocks(by_file[k])


def file_total(rows):
    return sum(f2(r["total"]) or f2(r["qty"]) * f2(r["unit_price"]) for r in rows)


def match(contract, total):
    best = None
    for a in aos:
        if a["contract_no"] != contract:
            continue
        for kind, v in (("current", f2(a["current_value"])), ("base", f2(a["base_value_excl_vat"]))):
            if v and abs(total - v) / v <= 0.01:
                diff = abs(total - v) / v
                if not best or diff < best[2]:
                    best = (a["ao_no"], kind, diff, v)
    return best


report, chosen = [], defaultdict(list)
seen = set()
for (contract, src), rows in sorted(by_file.items()):
    total = file_total(rows)
    sig = (contract, round(total), len(rows))
    folder_ao = rows[0]["ao_no"]
    if sig in seen:
        report.append((src, contract, folder_ao, "", "", "", "نسخة مكررة من ملف تاني"))
        continue
    seen.add(sig)
    m = match(contract, total) if total else None
    if m:
        ao, kind, diff, v = m
        how = "بالقيمة" + ("" if ao == folder_ao else f" (الفولدر بيقول {folder_ao or '—'})")
        report.append((src, contract, ao, kind, round(total, 2), f"{diff * 100:.2f}%", how))
        chosen[(contract, ao)].append((kind, diff, src, rows))
    elif folder_ao and any(a["contract_no"] == contract and a["ao_no"] == folder_ao for a in aos):
        a = next(a for a in aos if a["contract_no"] == contract and a["ao_no"] == folder_ao)
        v = f2(a["current_value"]) or f2(a["base_value_excl_vat"])
        diff = abs(total - v) / v if v and total else 1
        report.append((src, contract, folder_ao, "folder", round(total, 2), f"{diff * 100:.1f}%" if total else "—",
                       "بالفولدر — يتراجع" + (" (الملف من غير أسعار)" if not total else "")))
        chosen[(contract, folder_ao)].append(("folder", 1 + diff, src, rows))
    else:
        report.append((src, contract, folder_ao, "", round(total, 2), "", "مفيش تطابق — " + ("الملف من غير أسعار" if not total else "راجع يدوي")))

final = []
for (contract, ao), cands in chosen.items():
    cands.sort(key=lambda c: ({"current": 0, "base": 1}.get(c[0], 2), c[1]))  # النسخة الحالية (بعد الزيادة) الأول
    for i, (kind, diff, src, rows) in enumerate(cands):
        version = kind if i == 0 else f"{kind} (سابقة)"
        for r in rows:
            final.append((contract, ao, version, r["site_code"], r["item_code"], r["qty"], r["unit_price"], src))

with open(os.path.join(D, "ao_items_final.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(["contract_no", "ao_no", "version", "site_code", "item_code", "planned_qty", "unit_price", "source_file"])
    w.writerows(final)
with open(os.path.join(D, "ao_boq_match_report.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(["file", "contract_no", "ao_no", "matched_value", "file_total", "diff", "note"])
    w.writerows(report)

with_boq = {k for k in chosen}
print(f"أوامر تكليف ليها كميات: {len(with_boq)} من {len(aos)}  | سطور: {len(final)}")
missing = [f"{a['contract_no'][:3]} {a['ao_no']}" for a in aos if (a["contract_no"], a["ao_no"]) not in with_boq]
print("من غير كميات:", "، ".join(missing))
for r in report:
    print(f"  {r[2] or '—':5} {r[3]:8} {str(r[5]):7} {r[0][:55]}  {r[6]}")
