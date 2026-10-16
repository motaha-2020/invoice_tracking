import { History } from "lucide-react";
import { Badge, Card, CardBody, CategoryBadge, EmptyState, Num } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { InvoiceDetail } from "../invoice.repo";

export const ACTION_LABELS: Record<string, string> = {
  submit: "تقديم المستخلص",
  approve: "اعتماد وإحالة",
  return: "إعادة للاستيفاء",
  resubmit: "إعادة التقديم بعد الاستيفاء",
  category: "تحديد فئة التجاوز",
  qty: "تعديل الكمية المعتمدة",
  hold: "إيقاف مؤقت",
  release: "استئناف",
  pay: "تسجيل السداد",
  deductions: "مراجعة الاستقطاعات",
  retention: "صرف مبلغ محتجز",
};

/** تاب سجل الإجراءات (الأحدث أولاً) */
export function LogTab({ inv, steps }: { inv: InvoiceDetail; steps: Record<string, { short: string }> }) {
  if (!inv.log.length) return <Card><EmptyState icon={History} title="لا توجد إجراءات بعد">المستخلص ما زال مسودة لدى المقاول.</EmptyState></Card>;
  const name = (k: string | null) => (k === "company" ? inv.contract.company.name : k === "done" ? "السداد" : k ? (steps[k]?.short ?? k) : "");
  const tone = (a: string) => (a === "return" ? "border-cr6" : ["approve", "pay", "submit", "resubmit"].includes(a) ? "border-ok6" : "border-in6");
  return (
    <Card>
      <CardBody>
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {[...inv.log].reverse().map((e) => (
            <li key={e.id} className={cn("border-s-3 ps-3", tone(e.action))}>
              <div className="flex flex-wrap items-center gap-2">
                <b>{ACTION_LABELS[e.action] ?? e.action}</b>
                {e.category && <CategoryBadge code={e.category} />}
                {e.onBehalf && <Badge tone="p">تجاوز إداري</Badge>}
                {e.fromStep && e.toStep && e.fromStep !== e.toStep && (
                  <span className="text-xs text-tx3">{name(e.fromStep)} ← {name(e.toStep)}</span>
                )}
              </div>
              <div className="text-xs text-tx3">
                {e.by?.name ?? "المنظومة"} · <Num>{formatDateTime(e.at)}</Num>
              </div>
              {e.reasons.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">{e.reasons.map((r) => <Badge key={r.reason.id} tone="r">{r.reason.name}</Badge>)}</div>
              )}
              {e.note && <div className="mt-1.5 whitespace-pre-line rounded-base bg-hover px-3 py-2 text-[13px]">{e.note}</div>}
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}
