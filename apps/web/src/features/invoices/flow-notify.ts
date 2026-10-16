import "server-only";
import { todayCairo } from "@/features/workflow/workflow.service";
import type { FlowContext } from "./flow-config";
import { emailBody, emailSubject, notificationTitle, type MessageContext } from "./flow-messages";
import { findRoleHolders, type InvoiceDetail } from "./invoice.repo";

type Recipient = { id: string; name: string; email: string };
type OrgInvoice = { contract: { company: { id: string } }; ao: Pick<InvoiceDetail["ao"], "project"> };

/** المسؤولون عن الجهة اللي المستخلص وصل لها: المقاول، أو دور المرحلة بنطاق بيغطي المستخلص (+ البدلاء بالتفويض) */
export async function recipientsFor(ctx: FlowContext, inv: OrgInvoice, target: string | null, excludeUserId: string): Promise<Recipient[]> {
  if (!target) return [];
  const today = new Date(`${todayCairo()}T00:00:00Z`);
  let list: Recipient[] = [];
  if (target === "company") {
    list = await findRoleHolders("company", [{ type: "company", id: inv.contract.company.id }], today);
  } else {
    const role = ctx.stepRoles[target];
    if (!role) return [];
    const c = inv.ao.project?.central;
    list = await findRoleHolders(
      role,
      [
        { type: "central", id: c?.id },
        { type: "dept", id: c?.dept.id },
        { type: "general_dept", id: c?.dept.generalDept.id },
        { type: "sector", id: c?.dept.generalDept.sector.id },
        { type: "presidency", id: c?.dept.generalDept.sector.presidency.id },
      ],
      today,
    );
  }
  return list.filter((r) => r.id !== excludeUserId);
}

/** إشعار + بريد لكل مستلم */
export function messagesFor(m: MessageContext | null, recipients: Recipient[]) {
  if (!m) return { notifications: [], emails: [] };
  return {
    notifications: recipients.map((r) => ({ userId: r.id, title: notificationTitle(m) })),
    emails: recipients.map((r) => ({ toEmail: r.email, toName: r.name, subject: emailSubject(m), body: emailBody(m, r.name) })),
  };
}
