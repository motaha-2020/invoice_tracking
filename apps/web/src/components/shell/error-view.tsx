"use client";

import { OctagonAlert, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

type ErrorViewProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

/**
 * عرض الخطأ بالعربي. في الـ production Next بيخفي رسالة أي خطأ جاي من السيرفر،
 * فبنعرض رسالة عامة + الـ digest (اللي بيتطابق مع اللوج على السيرفر).
 */
export function ErrorView({ error, retry }: ErrorViewProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto mt-10 max-w-[560px] rounded-md border border-bd1 border-t-3 border-t-cr6 bg-card p-6 text-center shadow-card">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-cr1 text-cr6">
        <OctagonAlert className="size-6" strokeWidth={1.75} aria-hidden />
      </div>
      <h2 className="m-0 mb-1 text-lg font-bold">حصل خطأ في الصفحة</h2>
      <p className="m-0 text-tx2">حاجة غلط حصلت واحنا بنحمّل الصفحة. جرّب تاني، ولو المشكلة فضلت بلّغ فريق المتابعة.</p>
      {error.digest && (
        <p className="m-0 mt-2 text-xs text-tx3">
          كود الخطأ: <span className="num">{error.digest}</span>
        </p>
      )}
      <div className="mt-4 flex justify-center gap-2">
        <Button variant="pr" onClick={() => retry()}>
          <RotateCcw />
          حاول تاني
        </Button>
        <ButtonLink href="/">الرئيسية</ButtonLink>
      </div>
    </div>
  );
}
