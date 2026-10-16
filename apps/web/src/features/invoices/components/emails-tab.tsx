import { Mail } from "lucide-react";
import { Badge, Card, EmptyState, Num } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { listInvoiceEmails } from "../invoice.repo";

type Emails = Awaited<ReturnType<typeof listInvoiceEmails>>;

export const EMAIL_STATUS = {
  pending: { label: "قيد الإرسال", tone: "a" },
  sent: { label: "أُرسل", tone: "g" },
  failed: { label: "تعذّر الإرسال", tone: "r" },
} as const;

/** تاب البريد الإلكتروني المرسل بخصوص المستخلص */
export function EmailsTab({ emails }: { emails: Emails }) {
  if (!emails.length) return <Card><EmptyState icon={Mail} title="لم تُرسل رسائل بريد إلكتروني بخصوص هذا المستخلص" /></Card>;
  return (
    <div className="flex flex-col gap-2">
      {emails.map((m) => {
        const st = EMAIL_STATUS[m.status];
        return (
          <details key={m.id} className="rounded-md border border-bd1 bg-card shadow-card">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3">
              <Mail className="size-4 text-tx3" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{m.subject}</div>
                <div className="text-xs text-tx3">إلى: {m.toName ?? ""} <Num>{`<${m.toEmail}>`}</Num></div>
              </div>
              <Num className="text-xs text-tx3">{formatDateTime(m.sentAt ?? m.createdAt)}</Num>
              <Badge tone={st.tone}>{st.label}</Badge>
            </summary>
            <div className="whitespace-pre-wrap border-t border-bd1 px-4 py-3 text-[13px]">{m.body}</div>
            {m.lastError && <div className="border-t border-bd1 px-4 py-2 text-xs text-cr6">{m.lastError}</div>}
          </details>
        );
      })}
    </div>
  );
}
