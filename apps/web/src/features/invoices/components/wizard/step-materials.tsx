"use client";

import { Package, Scale, Trash2, X } from "lucide-react";
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Num, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { formatQty } from "@/lib/format";
import type { DraftPreview } from "../../draft-preview";
import type { DraftState } from "../../draft.types";
import { ExcelUpload } from "./excel-upload";

type Props = { d: DraftState; set: (p: Partial<DraftState>) => void; preview: DraftPreview | null; tried: boolean };

/** الخطوة 3: المهمات المنفذة (من توريد المصرية) ومقارنتها بالمخطط والمنصرف */
export function StepMaterials({ d, set, preview, tried }: Props) {
  const mc = preview?.materialCheck;
  let mi = 0;
  const matIdx = (mc?.rows ?? []).map((r) => (r.level !== "err" && !r.merged ? mi++ : null));
  const setQty = (i: number, v: string) => set({ materials: d.materials.map((m, j) => (j === i ? { ...m, qty: v } : m)) });
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="المهمات المنفذة" sub="المهمات من توريد الشركة المصرية للاتصالات التي رُكّبت في هذه الأعمال" />
        <CardBody className="flex flex-col gap-3">
          <ExcelUpload kind="materials" onRows={(r) => set({ materials: r.materials, materialsSource: "excel", materialsFile: r.fileName })} />
          {d.materials.length > 0 && (
            <div><Button variant="dg" size="sm" onClick={() => set({ materials: [], materialsSource: "", materialsFile: "" })}><Trash2 /> مسح الكل</Button></div>
          )}
          <Alert tone="i" title="المقارنة الرباعية">
            <span className="inline-flex items-center gap-1"><Scale className="size-3.5" aria-hidden /> يُقارن كل صنف بالمخطط في أمر التكليف، والمنصرف من المخازن، والمنفذ التراكمي، والمفوتر — وتظهر الفروق للمراجعين.</span>
          </Alert>
        </CardBody>
      </Card>
      {!d.materials.length || !mc ? (
        <Card><EmptyState icon={Package} title="لا توجد مهمات">إذا لم تتضمن الأعمال مهمات من توريد الشركة يمكنك المتابعة مباشرةً.</EmptyState></Card>
      ) : (
        <Card>
          <CardHeader
            title="مقارنة المهمات"
            sub={d.materialsSource === "excel" ? `ملف: ${d.materialsFile}` : d.materialsSource === "draft" ? "من المسودة" : undefined}
            actions={<>{mc.err > 0 && <Badge tone="r"><Num>{mc.err}</Num> خطأ</Badge>}{mc.warn > 0 && <Badge tone="a"><Num>{mc.warn}</Num> تنبيه</Badge>}</>}
          />
          <TableWrap>
            <Table className="text-[13px]">
              <THead>
                <tr>
                  <Th>رقم الشطب</Th><Th>الصنف</Th><Th>الوحدة</Th><Th align="end">المخطط</Th><Th align="end">المنصرف</Th>
                  <Th align="end">المنفذ السابق</Th><Th align="end">المنفذ الحالي</Th><Th align="end">التراكمي</Th><Th>الملاحظات</Th><Th />
                </tr>
              </THead>
              <TBody>
                {mc.rows.map((r) => {
                  const M = matIdx[r.i] != null ? preview!.materials[matIdx[r.i]!] : undefined;
                  const flags = M?.flags ?? [];
                  return (
                    <Tr key={r.i} flag={r.level === "err" || flags.some((f) => f.cls === "r") ? "r" : r.level === "warn" || flags.length ? "a" : undefined}>
                      <Td><b className="num">{r.code || "—"}</b></Td>
                      <Td className="min-w-[180px]">{M?.description ?? "—"}</Td>
                      <Td>{M?.unit ?? "—"}</Td>
                      <Td align="end">{M ? <Num>{formatQty(M.planned)}</Num> : "—"}</Td>
                      <Td align="end">{M ? <Num>{formatQty(M.issued)}</Num> : "—"}</Td>
                      <Td align="end">{M ? <Num>{formatQty(M.prevExecuted)}</Num> : "—"}</Td>
                      <Td align="end">
                        <input
                          className="h-7 w-24 rounded-base border border-bd2 bg-card px-2 text-end"
                          dir="ltr"
                          inputMode="decimal"
                          aria-label={`الكمية المنفذة ${r.code}`}
                          value={String(d.materials[r.i]?.qty ?? "")}
                          onChange={(e) => setQty(r.i, e.target.value)}
                        />
                      </Td>
                      <Td align="end" className={M && M.cumExecuted > M.issued ? "font-semibold text-cr6" : undefined}>{M ? <Num>{formatQty(M.cumExecuted)}</Num> : "—"}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {r.msgs.map((m) => <Badge key={m.text} tone={m.cls}>{m.text}</Badge>)}
                          {flags.map((f) => <Badge key={f.code} tone={f.cls}>{f.text}</Badge>)}
                          {!r.msgs.length && !flags.length && <Badge tone="g">مطابق</Badge>}
                        </div>
                      </Td>
                      <Td><Button size="sm" variant="gh" icon aria-label="حذف الصنف" onClick={() => set({ materials: d.materials.filter((_, j) => j !== r.i) })}><X /></Button></Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>
          {tried && mc.err > 0 && <CardBody><Alert tone="r">يرجى تصحيح الصفوف التي بها أخطاء أو حذفها للمتابعة.</Alert></CardBody>}
        </Card>
      )}
    </div>
  );
}
