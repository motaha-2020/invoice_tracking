import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, PageHeader, PageSkeleton } from "@/components/ui";
import type { SessionUser } from "@/features/auth/auth.types";
import { ImportPanel } from "@/features/imports/components/import-panel";
import { requireNavAccess } from "@/features/shell/nav.service";
import { BulkInvite } from "@/features/users/components/bulk-invite";
import { DelegationsPanel } from "@/features/users/components/delegations-panel";
import { PermissionMatrix } from "@/features/users/components/permission-matrix";
import { ScopeExplainer } from "@/features/users/components/scope-explainer";
import { TabLinks } from "@/features/users/components/tab-links";
import { UsersFilter } from "@/features/users/components/users-filter";
import { UsersTable } from "@/features/users/components/users-table";
import { parseRole } from "@/features/users/users.rules";
import * as users from "@/features/users/users.service";
import type { UserFilter } from "@/features/users/users.types";
import { getStepsByRole, todayCairo } from "@/features/workflow/workflow.service";

export const metadata: Metadata = { title: "المستخدمين والصلاحيات" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TABS = [
  { key: "list", label: "المستخدمين" },
  { key: "delegations", label: "التفويضات" },
  { key: "perms", label: "مصفوفة الصلاحيات" },
  { key: "scope", label: "مين يشوف إيه" },
  { key: "import", label: "رفع من Excel" },
];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UsersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function UsersContent({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireNavAccess("users");
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === one(sp.tab)) ? one(sp.tab)! : "list";
  const active = one(sp.active);
  const filter: UserFilter = {
    q: one(sp.q)?.slice(0, 100) || undefined,
    role: parseRole(one(sp.role)) ?? undefined,
    active: active === "1" || active === "0" ? active : undefined,
  };

  return (
    <>
      <PageHeader
        title="المستخدمين والصلاحيات"
        sub="كل مستخدم ليه دور (بيحدد يعمل إيه) ونطاق (بيحدد يشوف إيه)"
        crumbs={[{ label: "الرئيسية", href: "/" }, { label: "المستخدمين والصلاحيات" }]}
      />
      <TabLinks base="/users" tabs={TABS} current={tab} />
      <TabBody tab={tab} actor={actor} filter={filter} />
    </>
  );
}

async function TabBody({ tab, actor, filter }: { tab: string; actor: SessionUser; filter: UserFilter }) {
  switch (tab) {
    case "delegations": {
      const { rows, users: picks } = await users.getDelegations(actor);
      return <DelegationsPanel rows={rows} users={picks} today={todayCairo()} />;
    }
    case "perms": {
      const { matrix, editable } = await users.getPermissionMatrix(actor);
      return <PermissionMatrix matrix={matrix} editable={editable} />;
    }
    case "scope": {
      const [counts, { matrix }, stepsByRole] = await Promise.all([users.getRoleCounts(actor), users.getPermissionMatrix(actor), getStepsByRole()]);
      return <ScopeExplainer counts={counts} matrix={matrix} stepsByRole={stepsByRole} />;
    }
    case "import": {
      const pending = await users.countNeverInvited(actor);
      return (
        <div className="space-y-4">
          <ImportPanel
            templateId="04_المستخدمين"
            title="رفع المستخدمين من Excel"
            templateFile="04_المستخدمين.xlsx"
            hint="نفس الإيميل في أكتر من صف = أكتر من نطاق. الدعوات مش بتتبعت أوتوماتيك."
          />
          <BulkInvite pendingCount={pending} />
        </div>
      );
    }
    default: {
      const [{ users: rows, options }, counts] = await Promise.all([users.getUsersPage(actor, filter), users.getRoleCounts(actor)]);
      return (
        <Card>
          <UsersFilter filter={filter} roleCounts={counts} />
          <UsersTable users={rows} options={options} currentUserId={actor.id} />
        </Card>
      );
    }
  }
}
