import Link from "next/link";
import { Badge, CategoryBadge, Money, Num, SlaChip, TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { INVOICE_STATUS } from "@/lib/labels";
import type { InvoiceListRow, StepInfo } from "../invoices.service";

/** مين ماسك المستخلص دلوقتي (نفس holderLabel في الديمو) */
function holderLabel(inv: InvoiceListRow, steps: Record<string, StepInfo>): string {
  const short = (k: string | null) => (k ? (steps[k]?.short ?? k) : "—");
  switch (inv.status) {
    case "paid":
      return "—";
    case "draft":
      return "المقاول (مسودة)";
    case "on_hold":
      return `موقوف مؤقتاً — ${inv.holdReason ?? "بانتظار أمر التكليف"}`;
    case "returned":
      return inv.returnTo === "company" ? inv.contract.company.name : short(inv.returnTo);
    default:
      return short(inv.currentStep);
  }
}

type InvoiceTableProps = {
  rows: InvoiceListRow[];
  steps: Record<string, StepInfo>;
  /** إخفاء عمود الشركة (لمستخدم الشركة) */
  showCompany?: boolean;
};

/** جدول المستخلصات المشترك (المهام الواردة والقوائم والرئيسية) */
export function InvoiceTable({ rows, steps, showCompany = true }: InvoiceTableProps) {
  return (
    <TableWrap>
      <Table>
        <THead>
          <tr>
            <Th>المستخلص</Th>
            {showCompany && <Th>المقاول</Th>}
            <Th>اسم المسار / المشروع</Th>
            <Th>فئة التجاوز</Th>
            <Th>الجهة الحالية</Th>
            <Th>الحالة</Th>
            <Th>المدة المستهدفة</Th>
            <Th align="end">القيمة المعتمدة</Th>
          </tr>
        </THead>
        <TBody>
          {rows.map((inv) => {
            const st = INVOICE_STATUS[inv.status];
            return (
              <Tr key={inv.id} flag={inv.sla.k === "late" ? "r" : inv.sla.k === "due" ? "a" : undefined}>
                <Td>
                  <Link href={`/invoices/${inv.id}`} className="font-bold no-underline hover:underline">
                    <span className="num">{inv.invoiceNo}</span>
                  </Link>
                  <div className="text-xs text-tx3">
                    <Num>{inv.ao.aoNo}</Num>
                  </div>
                </Td>
                {showCompany && <Td>{inv.contract.company.name}</Td>}
                <Td>
                  <div>{inv.pathName || inv.ao.project?.name || "—"}</div>
                  <div className="text-xs text-tx3">
                    {inv.ao.project?.central.name ?? "—"}
                    {inv.workType && ` · ${inv.workType.name}`}
                  </div>
                </Td>
                <Td>
                  <CategoryBadge code={inv.category} suggested={inv.suggestedCategory} />
                </Td>
                <Td>{holderLabel(inv, steps)}</Td>
                <Td>
                  <Badge tone={st.tone} dot>
                    {st.label}
                  </Badge>
                </Td>
                <Td>
                  {inv.status === "draft" || inv.status === "paid" ? (
                    <span className="text-xs text-tx3">منذ <Num>{formatDate(inv.since)}</Num></span>
                  ) : (
                    <SlaChip tone={inv.sla.cls} label={inv.sla.label} elapsed={inv.sla.elapsed} sla={inv.sla.sla} />
                  )}
                </Td>
                <Td align="end">
                  <Money>{formatMoney(inv.gross)}</Money>
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </TableWrap>
  );
}
