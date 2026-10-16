"use client";

import type { Role } from "@it/db";
import { ChevronLeft, Save, Undo2 } from "lucide-react";
import { Fragment, useMemo, useState, useTransition } from "react";
import { Alert, Button, Card, CardBody, CardFooter, CardHeader, CategoryBadge, TBody, TFoot, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { ROLE_LABELS } from "@/lib/labels";
import { savePathsAction } from "../workflow.actions";
import { orderedPath, parseSla, sameCells, toggleCell, totalSla, type CategoryCells, type SlaMatrix, type StepMeta } from "../workflow.rules";

type Category = { code: string; name: string; cells: CategoryCells };
type Props = { steps: StepMeta[]; categories: Category[] };

const initial = (cats: Category[]): SlaMatrix => Object.fromEntries(cats.map((c) => [c.code, c.cells]));

/** المصفوفة: صفوف = المحطات، أعمدة = الفئات. الخانة = SLA بأيام العمل أو مقفولة. */
export function SlaMatrixEditor({ steps, categories }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(() => initial(categories));
  const [m, setM] = useState(saved);
  const dirty = useMemo(() => categories.filter((c) => !sameCells(saved[c.code] ?? {}, m[c.code] ?? {})).map((c) => c.code), [categories, saved, m]);

  const setCells = (code: string, cells: CategoryCells) => setM((x) => ({ ...x, [code]: cells }));

  const save = () =>
    start(async () => {
      const changed = Object.fromEntries(dirty.map((c) => [c, m[c]!]));
      const res = await savePathsAction(changed);
      toast.show(res.message ?? "", res.ok ? "ok" : "err");
      if (res.ok) setSaved(m);
    });

  const short = (k: string) => steps.find((s) => s.key === k)?.short ?? k;

  return (
    <div className="space-y-4">
      {dirty.length > 0 && (
        <Alert tone="a" title="توجد تعديلات غير محفوظة">
          الفئات المعدَّلة: <span className="num">{dirty.join("، ")}</span> — لن تتأثر المستخلصات إلا بعد الحفظ.
        </Alert>
      )}
      <Card>
        <CardHeader title="مراحل الاعتماد × فئات التجاوز" sub="يرجى تحديد المرحلة لإدراجها في مسار الاعتماد، وإدخال المدة المستهدفة (SLA) بأيام العمل الرسمية (فارغ = دون مدة مستهدفة)" />
        <TableWrap>
          <Table className="text-sm">
            <THead>
              <Tr>
                <Th>مرحلة الاعتماد</Th>
                <Th>المسؤول</Th>
                {categories.map((c) => (
                  <Th key={c.code} align="center" title={c.name}><CategoryBadge code={c.code} /></Th>
                ))}
              </Tr>
            </THead>
            <TBody>
              {steps.map((s) => (
                <Tr key={s.key}>
                  <Td><b>{s.short}</b><div className="text-xs text-tx3">{s.name}</div></Td>
                  <Td className="text-xs">{ROLE_LABELS[s.role as Role] ?? s.role}</Td>
                  {categories.map((c) => {
                    const cells = m[c.code] ?? {};
                    const on = s.key in cells;
                    return (
                      <Td key={c.code} align="center">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--brand)]"
                            checked={on}
                            aria-label={`${s.short} في ${c.code}`}
                            onChange={(e) => setCells(c.code, toggleCell(cells, s.key, e.target.checked))}
                          />
                          {on ? (
                            <input
                              type="number"
                              min={0}
                              max={60}
                              inputMode="numeric"
                              placeholder="—"
                              value={cells[s.key] ?? ""}
                              aria-label={`SLA ${s.short} ${c.code}`}
                              className="num h-7 w-14 rounded-base border border-bd2 bg-card px-1.5 text-center text-[13px]"
                              onChange={(e) => {
                                const v = parseSla(e.target.value);
                                if (v.value === undefined) toast.show(v.error, "err");
                                else setCells(c.code, { ...cells, [s.key]: v.value });
                              }}
                            />
                          ) : (
                            <span className="w-14" />
                          )}
                        </div>
                      </Td>
                    );
                  })}
                </Tr>
              ))}
            </TBody>
            <TFoot>
              <Tr>
                <Td>إجمالي المدة المستهدفة</Td>
                <Td />
                {categories.map((c) => (
                  <Td key={c.code} align="center">
                    <span className="num">{totalSla(m[c.code] ?? {})}</span> يوم
                    <div className="text-xs font-medium"><span className="num">{Object.keys(m[c.code] ?? {}).length}</span> مرحلة</div>
                  </Td>
                ))}
              </Tr>
            </TFoot>
          </Table>
        </TableWrap>
        <CardFooter className="flex flex-wrap items-center gap-2">
          <span className="flex-1">تُدرج المرحلة في موضعها وفق ترتيب مراحل الاعتماد. يجب أن يمر مسار الاعتماد بمدير التنفيذ وأن ينتهي بالإدارة المالية، ولا يمكن إزالة مرحلة توجد عليها مستخلصات حالياً.</span>
          <Button size="sm" disabled={!dirty.length || pending} onClick={() => setM(saved)}><Undo2 aria-hidden /> تراجع</Button>
          <Button size="sm" variant="pr" disabled={!dirty.length || pending} onClick={save}><Save aria-hidden /> {pending ? "جارٍ الحفظ…" : "حفظ مسار الاعتماد"}</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader title="مسار الاعتماد لكل فئة" sub="معاينة مباشرة — تُحدَّث مع كل تعديل" />
        <CardBody className="space-y-0 overflow-x-auto pt-1">
          {categories.map((c) => {
            const path = orderedPath(m[c.code] ?? {}, steps);
            return (
              <div key={c.code} className="flex items-start gap-3 border-b border-bd1 py-2.5 last:border-b-0">
                <div className="w-[170px] shrink-0">
                  <CategoryBadge code={c.code} /> <b className="num text-sm">{totalSla(m[c.code] ?? {})}</b> <span className="text-sm">يوم</span>
                  <div className="text-xs text-tx3">{c.name}</div>
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                  {path.map((p, i) => (
                    <Fragment key={p.stepKey}>
                      {i > 0 && <ChevronLeft className="size-3.5 text-tx4" aria-hidden />}
                      <span className="rounded-sm bg-brand-soft px-2 py-px text-xs font-semibold text-brand-tx">
                        {short(p.stepKey)} · <span className="num">{p.slaDays ?? "—"}</span>{p.slaDays != null && " ي"}
                      </span>
                    </Fragment>
                  ))}
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>
    </div>
  );
}
