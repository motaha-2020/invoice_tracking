import { ChevronDown, LogOut } from "lucide-react";
import { logoutAction } from "@/features/auth/auth.actions";
import { initialOf } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { popoverPanel } from "./popover";

type UserMenuProps = {
  name: string;
  email: string;
  roles: { role: string; scope: string }[];
};

export function UserMenu({ name, email, roles }: UserMenuProps) {
  return (
    <>
      <button
        type="button"
        popoverTarget="who-pop"
        className="flex h-[34px] max-w-[280px] cursor-pointer items-center gap-2 rounded-base border-0 bg-white/12 px-2.5 text-white max-nav:px-1.5"
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-p600">
          {initialOf(name)}
        </span>
        <span className="truncate font-semibold max-nav:hidden">{name}</span>
        <ChevronDown className="size-4 shrink-0 max-nav:hidden" strokeWidth={1.75} aria-hidden />
      </button>
      <div id="who-pop" popover="auto" className={popoverPanel("w-[320px]")}>
        <div className="border-b border-bd1 p-3.5">
          <b>{name}</b>
          <div className="text-xs text-tx3">{email}</div>
          <div className="mt-2 flex flex-col gap-1.5">
            {roles.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5">
                <Badge tone="p">{r.role}</Badge>
                <Badge tone="n">{r.scope}</Badge>
              </div>
            ))}
            {roles.length === 0 && <Badge tone="a">مفيش دور متحدد للحساب ده</Badge>}
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-3.5 py-2.5 text-start text-[13px] text-tx hover:bg-hover"
          >
            <span className="grid size-7 place-items-center rounded-full bg-sunken text-tx2">
              <LogOut className="size-4" strokeWidth={1.75} aria-hidden />
            </span>
            تسجيل الخروج
          </button>
        </form>
      </div>
    </>
  );
}
