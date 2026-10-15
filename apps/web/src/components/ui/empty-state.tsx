import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon = Inbox, title, children, action }: EmptyStateProps) {
  return (
    <div className="px-5 py-10 text-center text-tx3">
      <div className="mx-auto mb-2.5 grid size-12 place-items-center rounded-full bg-sunken text-tx3">
        <Icon className="size-[22px]" strokeWidth={1.75} aria-hidden />
      </div>
      <b className="mb-0.5 block text-[15px] text-tx">{title}</b>
      {children}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
