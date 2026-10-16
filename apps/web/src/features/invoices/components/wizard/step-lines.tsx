"use client";

import { Eraser, Info, Keyboard, Table2, Trash2, X } from "lucide-react";
import { Alert, Badge, Button, Card, CardBody, CardHeader, CategoryBadge, EmptyState, Money, Num, TBody, TFoot, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { formatMoney, formatQty } from "@/lib/format";
import type { DraftPreview } from "../../draft-preview";
import type { AoWorkspace, DraftState } from "../../draft.types";
import { ExcelUpload } from "./excel-upload";

type Props = { d: DraftState; set: (p: Partial<DraftState>) => void; ws: AoWorkspace | null; preview: DraftPreview | null; tried: boolean };

/** الخطوة 2: بنود الأعمال من Excel أو إدخال يدوي — السعر والوصف من العقد */
export function StepLines({ d, set, ws, preview, tried }: Props) {
  const manual = () => {
    if (!ws) return;
    const have = new Map<string, number>();
    for (const l of d.lines) have.set(String(l.code), (have.get(String(l.code)) ?? 0) + (Number(l.qty) || 0));
    const rows = ws.items.filter((i) => i.id in ws.planned).map((i) => ({ code: i.itemNo, qty: have.get(i.itemNo) ?? "", manual: true }));
    set({ lines: rows, linesSource: "manual", linesFile: "" });
  };
  const setQty = (i: number, v: string) => set({ lines: d.lines.map((l, j) => (j === i ? { ...l, qty: v } : l)) });
  const del = (i: number) => set({ lines: d.lines.filter((_, j) => j !== i) });

  const lc = preview?.lineCheck;
  let li = 0;
  const lineIdx = (lc?.rows ?? []).map((r) => ((r.level === "ok" || r.level === "warn") && !r.merged ? li++ : null));
  const byId = new Map((ws?.items ?? []).map((i) => [i.id, i]));
  const source = { excel: `ملف: ${d.linesFile}`, manual: "إدخال يدوي", draft: "من المسودة", "": "" }[d.linesSource];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="بنود الأعمال" sub="ارفع ملف Excel برقم البند والكمية — أو أدخل الكميات يدوياً" />
        <CardBody className="flex flex-col gap-3">
          <ExcelUpload kind="lines" onRows={(r) => set({ lines: r.lines, linesSource: "excel", linesFile: r.fileName })} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={manual} disabled={!ws}><Keyboard /> إدخال يدوي لبنود أمر التكليف</Button>
            {d.lines.length > 0 && <Button variant="dg" size="sm" onClick={() => set({ lines: [], linesSource: "", linesFile: "" })}><Trash2 /> مسح الكل</Button>}
          </div>
          <Alert tone="i">الوصف والوحدة وسعر الوحدة من جدول كميات العقد وليس من الملف — يكفي في الملف رقم البند والكمية (وكود الموقع اختيارياً).</Alert>
        </CardBody>
      </Card>

      {!d.lines.length || !lc ? (
        <Card><EmptyState icon={Table2} title="لم تُضف بنود بعد">ارفع الملف أو استخدم الإدخال اليدوي لعرض المعاينة.</EmptyState></Card>
      ) : (
        <Card>
          <CardHeader
            title="معاينة البنود"
            sub={source}
            actions={
              <>
                <Badge tone="g"><Num>{lc.rows.filter((r) => r.level === "ok").length}</Num> سليم</Badge>
                {lc.warn > 0 && <Badge tone="a"><Num>{lc.warn}</Num> تنبيه</Badge>}
                {lc.err > 0 && <Badge tone="r"><Num>{lc.err}</Num> خطأ</Badge>}
                <Badge><Num>{lc.lines.length}</Num> بند في المستخلص</Badge>
                {lc.err > 0 && (
                  <Button size="sm" variant="dg" onClick={() => set({ lines: d.lines.filter((_, i) => lc.rows[i]?.level !== "err") })}><Eraser /> حذف الصفوف التي بها أخطاء</Button>
                )}
              </>
            }
          />
          <TableWrap>
            <Table className="text-[13px]">
              <THead>
                <tr>
                  <Th>رقم البند</Th><Th>الوصف</Th><Th>الوحدة</Th><Th align="end">سعر الوحدة</Th><Th align="end">الكمية الحالية</Th>
                  <Th align="end">السابق</Th><Th align="end">التراكمي</Th><Th align="end">المخطط</Th><Th align="end">الإجمالي</Th><Th>الحالة</Th><Th />
                </tr>
              </THead>
              <TBody>
                {lc.rows.map((r) => {
                  const src = d.lines[r.i]!;
                  const it = r.contractItemId ? byId.get(r.contractItemId) : undefined;
                  const L = lineIdx[r.i] != null ? preview!.lines[lineIdx[r.i]!] : undefined;
                  const qtyCell = src.manual ? (
                    <input
                      className="h-7 w-24 rounded-base border border-bd2 bg-card px-2 text-end"
                      dir="ltr"
                      inputMode="decimal"
                      aria-label={`كمية البند ${r.code}`}
                      value={String(src.qty)}
                      placeholder="0"
                      onChange={(e) => setQty(r.i, e.target.value)}
                    />
                  ) : (
                    <Num>{Number.isNaN(r.qty) ? "—" : formatQty(r.qty)}</Num>
                  );
                  return (
                    <Tr key={r.i} flag={r.level === "err" ? "r" : r.level === "warn" ? "a" : undefined} className={r.level === "skip" ? "opacity-60" : undefined}>
                      <Td><b className="num">{r.code || "—"}</b>{r.site && <div className="num text-xs text-tx3">{r.site}</div>}</Td>
                      <Td className="min-w-[200px]">{it?.description ?? "—"}</Td>
                      <Td>{it?.unit ?? "—"}</Td>
                      <Td align="end">{it?.unitPrice != null ? <Num>{formatMoney(it.unitPrice)}</Num> : "—"}</Td>
                      <Td align="end">{qtyCell}</Td>
                      <Td align="end">{L ? <Num>{formatQty(L.prevQty)}</Num> : "—"}</Td>
                      <Td align="end" className={L && L.overQty > 0 ? "font-semibold text-cr6" : undefined}>{L ? <Num>{formatQty(L.cumQty)}</Num> : "—"}</Td>
                      <Td align="end">{L ? <Num>{formatQty(L.plannedQty)}</Num> : "—"}</Td>
                      <Td align="end">{L?.total != null ? <Money>{formatMoney(L.total)}</Money> : "—"}</Td>
                      <Td>
                        {r.level === "skip" ? <span className="text-xs text-tx4">—</span> : r.msgs.length ? (
                          <div className="flex flex-wrap gap-1">{r.msgs.map((m) => <Badge key={m.text} tone={m.cls}>{m.text}</Badge>)}</div>
                        ) : <Badge tone="g">سليم</Badge>}
                      </Td>
                      <Td>{!src.manual && <Button size="sm" variant="gh" icon aria-label="حذف الصف" onClick={() => del(r.i)}><X /></Button>}</Td>
                    </Tr>
                  );
                })}
              </TBody>
              <TFoot>
                <tr>
                  <Td colSpan={8}>إجمالي المستخلص (قبل الضريبة)</Td>
                  <Td align="end"><Money>{formatMoney(preview!.gross)}</Money></Td>
                  <Td colSpan={2}>جنيه</Td>
                </tr>
              </TFoot>
            </Table>
          </TableWrap>
          {tried && lc.err > 0 && <CardBody><Alert tone="r">يرجى تصحيح الصفوف التي بها أخطاء أو حذفها للمتابعة.</Alert></CardBody>}
          {tried && !lc.lines.length && <CardBody><Alert tone="r">يجب أن يتضمن المستخلص بنداً واحداً على الأقل بكمية أكبر من صفر.</Alert></CardBody>}
        </Card>
      )}

      {preview && preview.lines.length > 0 && ws && <CategoryBox preview={preview} />}
    </div>
  );
}

export function CategoryBox({ preview }: { preview: DraftPreview }) {
  const s = preview.suggestion;
  return (
    <Card>
      <CardHeader title="فئة التجاوز المقترحة" actions={<CategoryBadge suggested={s.category} />} />
      <CardBody className="flex flex-col gap-2 text-[13px]">
        <ul className="m-0 list-disc ps-5">{s.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        <div className="flex items-center gap-1.5 text-xs text-tx3"><Info className="size-3.5" aria-hidden /> يحدد مدير التنفيذ الفئة النهائية — الفئة الحالية مقترحة من الكميات.</div>
      </CardBody>
    </Card>
  );
}
