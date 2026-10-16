import { CheckCircle2, FilePen, Files, Inbox, PauseCircle, Undo2 } from "lucide-react";
import { Suspense } from "react";
import { Card, CardBody, CardHeader, EmptyState, Kpi, PageHeader, PageSkeleton } from "@/components/ui";
import { can } from "@/features/auth/permissions";
import { requireUser } from "@/features/auth/session";
import { hasRole } from "@/features/auth/scope";
import { InvoiceTable } from "@/features/invoices/components/invoice-table";
import { getHomeStats, getStepNames, listSlaAlerts } from "@/features/invoices/invoices.service";
import { BackupStatus } from "@/features/system/components/backup-status";
import { getBackupHealth } from "@/features/system/backup.service";
import { formatCount, formatDate } from "@/lib/format";

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const user = await requireUser();
  const [stats, alerts, steps, isAdmin] = await Promise.all([getHomeStats(user), listSlaAlerts(user), getStepNames(), can(user, "users.manage")]);
  const backup = isAdmin ? await getBackupHealth() : null;
  const isCompany = hasRole(user, "company");
  const s = stats.byStatus;

  return (
    <>
      <PageHeader
        title={`مرحباً، ${user.name}`}
        sub={
          <>
            ملخص المستخلصات ضمن نطاق صلاحيتك · اليوم <span className="num">{formatDate(new Date())}</span>
          </>
        }
      />
      {backup && <BackupStatus h={backup} />}
      <div className="mb-4 grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        <Kpi
          icon={Inbox}
          label={isCompany ? "بانتظار إجرائك" : "بانتظار اعتمادك"}
          value={formatCount(stats.inbox)}
          sub="في المهام الواردة"
          tone={stats.inbox > 0 ? "a" : undefined}
          href="/inbox"
        />
        <Kpi icon={Files} label="قيد الاعتماد" value={formatCount(s.active)} href="/invoices?status=active" />
        <Kpi icon={Undo2} label="معاد للاستيفاء" value={formatCount(s.returned)} href="/invoices?status=returned" />
        <Kpi
          icon={PauseCircle}
          label="موقوف مؤقتاً"
          value={formatCount(s.on_hold)}
          sub="بانتظار أمر تكليف أو ملحق أمر تكليف"
          tone={s.on_hold > 0 ? "a" : undefined}
          href="/invoices?status=on_hold"
        />
        <Kpi icon={CheckCircle2} label="تم السداد" value={formatCount(s.paid)} tone="g" href="/invoices?status=paid" />
        {isCompany && <Kpi icon={FilePen} label="مسودات" value={formatCount(s.draft)} href="/invoices?status=draft" />}
      </div>
      <Card>
        <CardHeader title="المستخلصات المتجاوزة للمدة المستهدفة (SLA)" sub="بأيام العمل الرسمية في كل مرحلة اعتماد" />
        {alerts.length === 0 ? (
          <CardBody>
            <EmptyState icon={CheckCircle2} title="لا توجد مستخلصات متجاوزة للمدة المستهدفة">
              <div className="text-[13px]">ستظهر هنا المستخلصات المتجاوزة للمدة والتي قاربت مدتها على الانتهاء.</div>
            </EmptyState>
          </CardBody>
        ) : (
          <InvoiceTable rows={alerts} steps={steps} showCompany={!isCompany} />
        )}
      </Card>
    </>
  );
}
