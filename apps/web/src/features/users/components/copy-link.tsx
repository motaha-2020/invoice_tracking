"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";

/** رابط الدعوة بيظهر مرة واحدة بس (الـ DB فيه الـ hash بس) — فلازم زرار نسخ */
export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        dir="ltr"
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="رابط الدعوة"
        className="h-[30px] min-w-0 flex-1 rounded-base border border-bd2 bg-hover px-2 text-xs text-tx2"
      />
      <Button
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            // من غير clipboard (http مثلاً) — الخانة نفسها بتتعلّم ويتنسخ يدوي
          }
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "اتنسخ" : "نسخ"}
      </Button>
    </div>
  );
}
