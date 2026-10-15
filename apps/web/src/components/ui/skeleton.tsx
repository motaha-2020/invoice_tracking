import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-base bg-sunken", className)} />;
}

/** fallback عام للصفحات اللي بتستنى بيانات المستخدم */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="جاري التحميل">
      <Skeleton className="mb-2 h-3 w-40" />
      <Skeleton className="mb-6 h-7 w-64" />
      <div className="mb-4 grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-md" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-md" />
    </div>
  );
}
