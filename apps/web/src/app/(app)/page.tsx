import { CheckCircle2, FilePen, Files, Inbox, PauseCircle, Undo2 } from "lucide-react";
import { Suspense } from "react";
import { Card, CardBody, CardHeader, EmptyState, Kpi, PageHeader, PageSkeleton } from "@/components/ui";
import { requireUser } from "@/features/auth/session";
import { hasRole } from "@/features/auth/scope";
import { getHomeStats } from "@/features/invoices/invoices.service";
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
  const stats = await getHomeStats(user);
  const isCompany = hasRole(user, "company");
  const s = stats.byStatus;

  return (
    <>
      <PageHeader
        title={`أهلاً، ${user.name}`}
        sub={
          <>
            ملخص المستخلصات في نطاقك · النهارده <span className="num">{formatDate(new Date())}</span>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        <Kpi
          icon={Inbox}
          label={isCompany ? "مطلوب منك" : "مستنيين اعتمادك"}
          value={formatCount(stats.inbox)}
          sub="في صندوق الوارد"
          tone={stats.inbox > 0 ? "a" : undefined}
          href="/inbox"
        />
        <Kpi icon={Files} label="جاري في المسار" value={formatCount(s.active)} href="/invoices?status=active" />
        <Kpi icon={Undo2} label="مرتجع" value={formatCount(s.returned)} href="/invoices?status=returned" />
        <Kpi
          icon={PauseCircle}
          label="معلّق"
          value={formatCount(s.on_hold)}
          sub="بانتظار أمر تكليف أو ملحق"
          tone={s.on_hold > 0 ? "a" : undefined}
          href="/invoices?status=on_hold"
        />
        <Kpi icon={CheckCircle2} label="تم الصرف" value={formatCount(s.paid)} tone="g" href="/invoices?status=paid" />
        {isCompany && <Kpi icon={FilePen} label="مسودات" value={formatCount(s.draft)} href="/invoices?status=draft" />}
      </div>
      <Card>
        <CardHeader title="المتأخر عن الـ SLA" sub="حسب أيام العمل في كل محطة" />
        <CardBody>
          {/* TODO: يتحسب من @it/domain (أيام العمل + SLA الفئة) لما الحزمة تجهز */}
          <EmptyState title="قيد البناء">
            <div className="text-[13px]">هيظهر هنا المستخلصات المتأخرة وقرب ميعادها.</div>
          </EmptyState>
        </CardBody>
      </Card>
    </>
  );
}
