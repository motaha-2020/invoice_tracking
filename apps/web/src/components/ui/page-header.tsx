import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

export type Crumb = { label: string; href?: string };

type PageHeaderProps = {
  title: ReactNode;
  sub?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
};

export function PageHeader({ title, sub, crumbs = [], actions }: PageHeaderProps) {
  return (
    <>
      {crumbs.length > 0 && (
        <nav aria-label="مسار الصفحة" className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs text-tx3">
          {crumbs.map((c, i) => (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 && <ChevronLeft className="size-3.5" aria-hidden />}
              {c.href ? (
                <Link href={c.href} className="text-tx3 no-underline hover:text-brand-tx">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>
              )}
            </Fragment>
          ))}
        </nav>
      )}
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="m-0 text-2xl font-bold leading-tight tracking-[-0.01em] max-sm:text-xl">{title}</h1>
          {sub != null && <p className="mt-1 mb-0 text-tx2">{sub}</p>}
        </div>
        {actions != null && <div className="ms-auto flex flex-wrap gap-2">{actions}</div>}
      </div>
    </>
  );
}
