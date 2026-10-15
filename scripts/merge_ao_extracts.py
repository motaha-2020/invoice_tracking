"""
merge_ao_extracts.py — يجمع اللي اتقري من خطابات أوامر التكليف / الملاحق / البرقيات الممسوحة
(data-import/pdf-extracts/extract_group*.json) في جداول جاهزة للاستيراد:

  data-import/ao_master.csv        — أمر تكليف واحد في كل صف: العقد، الرقم، التاريخ، الموضوع، القيمة الأصلية،
                                     الزيادات، القيمة الحالية، التزام التخطيط، الدمغات، شروط الدفع، المصادر، ملاحظات
  data-import/ao_changes.csv       — كل ملحق / تجديد التزام مالي كسطر مستقل (تاريخ الحركة)
  data-import/contract_terms.csv   — شروط كل عقد (الدفع، الضمان، الغرامات، الضمان الفني، القيمة وزياداتها)
التشغيل:  python -I scripts/merge_ao_extracts.py data-import
"""
import csv
import glob
import json
import os
import re
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")
OUT = sys.argv[1] if len(sys.argv) > 1 else "data-import"
docs = []
for f in sorted(glob.glob(os.path.join(OUT, "pdf-extracts", "extract_group*.json"))):
    docs += json.load(open(f, encoding="utf-8"))
print("documents:", len(docs))


def contract_of(d):
    c = d.get("contract_no") or ""
    p = d.get("path", "")
    if not c:
        c = "231/2026/1/12" if "231" in p and "2026" in p else "232/2025/1/36" if "232" in p else ""
    return c


def norm_ao(a):
    m = re.search(r"(\d+)", str(a))
    return f"PO{int(m.group(1)):02d}" if m else str(a)


def terms_str(d):
    return " / ".join(f"{t.get('pct')}% {t.get('condition', '')}".strip() for t in (d.get("payment_terms") or []))


aos = defaultdict(lambda: {"sources": [], "notes": [], "changes": []})
changes = []
contracts = defaultdict(lambda: {"sources": [], "terms": set(), "guarantee": set(), "penalties": set(), "warranty": set(), "values": [], "other": set()})

for d in docs:
    c = contract_of(d)
    t = d.get("doc_type", "")
    src = os.path.basename(d.get("path", ""))
    nums = [norm_ao(a) for a in (d.get("ao_nos") or [])]
    # نفس أمر التكليف ممكن يتكرر في الخطاب (الأعمال + ملحق تخطيط/خرائط) — الأكبر = الأعمال، والباقي ملاحق تخطيط
    per_all = defaultdict(list)
    for x in d.get("per_ao_values") or []:
        if x.get("ao") and x.get("value"):
            per_all[norm_ao(x["ao"])].append(x)
    per = {a: max(xs, key=lambda x: x["value"]) for a, xs in per_all.items()}
    annex = {a: sum(x["value"] for x in xs if x is not per[a]) for a, xs in per_all.items() if len(xs) > 1}
    if t in ("برقية قبول", "ملحق برقية قبول", "ملحق عقد"):
        k = contracts[c]
        k["sources"].append(f"{t}: {src} ({d.get('date') or '؟'})")
        if terms_str(d): k["terms"].add(terms_str(d))
        if d.get("final_guarantee_pct"): k["guarantee"].add(f"{d['final_guarantee_pct']}%")
        if d.get("penalties"): k["penalties"].add(d["penalties"])
        if d.get("warranty"): k["warranty"].add(d["warranty"])
        if d.get("value_excl_vat") or d.get("increase"):
            inc = d.get("increase") or {}
            k["values"].append(f"{d.get('date') or '؟'}: {inc.get('new_total') or d.get('value_excl_vat')}")
        for o in d.get("other_conditions") or []:
            k["other"].add(o)
        continue
    if t == "أمر تكليف":
        k = contracts[c]
        if terms_str(d): k["terms"].add(terms_str(d))
        if d.get("final_guarantee_pct"): k["guarantee"].add(f"{d['final_guarantee_pct']}%")
        if d.get("penalties"): k["penalties"].add(d["penalties"])
        if d.get("warranty"): k["warranty"].add(d["warranty"])
        for a in nums:
            r = aos[(c, a)]
            v = per.get(a, {}).get("value") if per else None
            if v is None and len(nums) == 1:
                v = d.get("value_excl_vat")
            if v:  # خطاب أمر التكليف ممكن يبقى معاه ملحق تخطيط صغير — بناخد القيمة الأكبر (قيمة الأعمال)
                r["base_value"] = max(v, r.get("base_value") or 0)
            if annex.get(a):
                r["planning_annex"] = annex[a]
            for fld in ("date", "subject", "area", "central", "project_name", "duration"):
                if d.get(fld) and not r.get(fld):
                    r[fld] = d[fld]
            if per.get(a, {}).get("desc") and not r.get("project_name"):
                r["project_name"] = per[a]["desc"]
            if d.get("planning_commitment") and len(nums) == 1:
                r["planning_commitment"] = d["planning_commitment"]
            st = d.get("stamps") or {}
            if len(nums) == 1 and st.get("total"):
                r["stamps_total"] = st["total"]
            if terms_str(d):
                r["payment_terms"] = terms_str(d)
            if d.get("final_guarantee_pct"):
                r["guarantee_pct"] = d["final_guarantee_pct"]
            r["sources"].append(src)
            if d.get("notes"):
                r["notes"].append(d["notes"])
            r["confidence"] = min(r.get("confidence", "high"), d.get("confidence", "high"), key=["low", "medium", "high"].index)
    elif t in ("ملحق أمر تكليف", "تجديد التزام مالي"):
        inc = d.get("increase") or {}
        for a in nums:
            row = dict(contract=c, ao=a, kind=t, date=d.get("date") or "", base=inc.get("base_value") or "",
                       increase=inc.get("increase_value") or "", new_total=inc.get("new_total") or "",
                       source=src, notes=(d.get("notes") or "")[:300])
            if len(nums) > 1 and per.get(a):
                row["new_total"] = per[a].get("value") or row["new_total"]
            changes.append(row)
            aos[(c, a)]["sources"].append(src)
    elif t == "توصية بإصدار أمر تكليف":
        for a in nums:
            r = aos[(c, a)]
            r.setdefault("recommended_value", d.get("value_excl_vat"))
            for fld in ("date", "subject", "area", "project_name"):
                if d.get(fld) and not r.get(fld):
                    r[fld] = d[fld]
            r["sources"].append(src)
            r["notes"].append("من التوصية فقط — أمر التكليف نفسه مش في الملفات")

# القيمة الحالية = آخر ملحق زيادة (مش تجديد الالتزام المالي) وإلا القيمة الأصلية
seen_changes = set()
for ch in sorted(changes, key=lambda x: str(x["date"])):
    key = (ch["contract"], ch["ao"], str(ch["new_total"]), ch["kind"])
    if key in seen_changes:
        ch["duplicate"] = True
        continue
    seen_changes.add(key)
    r = aos[(ch["contract"], ch["ao"])]
    if not r.get("base_value") and ch["base"]:  # أمر التكليف الأصلي مش في الملفات — القيمة الأصلية من الملحق
        r["base_value"] = float(ch["base"])
        r["notes"].append("القيمة الأصلية من الملحق — خطاب أمر التكليف نفسه مش موجود")
    if ch["kind"] == "ملحق أمر تكليف" and ch["new_total"]:
        r["current_value"] = ch["new_total"]
        r["increases"] = r.get("increases", 0) + (float(ch["increase"]) if ch["increase"] else 0)
    if ch["kind"] == "تجديد التزام مالي" and ch["new_total"]:
        r["financial_commitment"] = ch["new_total"]

rows = []
for (c, a), r in sorted(aos.items(), key=lambda x: (x[0][0], x[0][1])):
    base = r.get("base_value") or r.get("recommended_value") or ""
    rows.append([c, a, r.get("date", ""), r.get("subject", "")[:200], r.get("area", "") or "", r.get("central", "") or "",
                 r.get("project_name", "") or "", base, r.get("increases", "") or "", r.get("current_value") or base,
                 r.get("financial_commitment", ""), r.get("planning_annex", "") or "", r.get("stamps_total", "") or "",
                 r.get("payment_terms", "") or "", r.get("guarantee_pct", "") or "", r.get("duration", "") or "",
                 r.get("confidence", ""), " | ".join(sorted(set(r["sources"]))), " | ".join(r["notes"])[:600]])

with open(os.path.join(OUT, "ao_master.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(["contract_no", "ao_no", "ao_date", "subject", "area", "central", "project_name", "base_value_excl_vat",
                "increases", "current_value", "financial_commitment", "planning_annex_value", "stamps_total",
                "payment_terms", "final_guarantee_pct", "duration", "confidence", "sources", "notes"])
    w.writerows(rows)
with open(os.path.join(OUT, "ao_changes.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(["contract_no", "ao_no", "kind", "date", "base_value", "increase", "new_total", "duplicate", "source", "notes"])
    for ch in changes:
        w.writerow([ch["contract"], ch["ao"], ch["kind"], ch["date"], ch["base"], ch["increase"], ch["new_total"], "نعم" if ch.get("duplicate") else "", ch["source"], ch["notes"]])
with open(os.path.join(OUT, "contract_terms.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(["contract_no", "payment_terms", "final_guarantee", "penalties", "warranty", "value_history", "other_conditions", "sources"])
    for c, k in sorted(contracts.items()):
        w.writerow([c, " || ".join(sorted(k["terms"])), " / ".join(sorted(k["guarantee"])), " || ".join(sorted(k["penalties"])),
                    " || ".join(sorted(k["warranty"])), " → ".join(k["values"]), " || ".join(sorted(k["other"]))[:2000], " | ".join(k["sources"])])

print("AOs:", len(rows), "| changes:", len(changes), "| contracts:", len(contracts))
for r in rows:
    print(f"  {r[0]} {r[1]:5} {str(r[2]):10} base={r[7]!s:>14} now={r[9]!s:>14}  {str(r[6] or r[3])[:50]}")
