"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { useRef, useTransition } from "react";
import { Button, buttonClasses } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { parseRowsFileAction } from "../../draft.actions";
import type { LineRowState, MaterialRowState } from "../../draft.types";

type Props = {
  kind: "lines" | "materials";
  onRows: (rows: { lines: LineRowState[]; materials: MaterialRowState[]; fileName: string }) => void;
};

const TEMPLATES = { lines: "09_بنود_المستخلص.xlsx", materials: "10_مهمات_المستخلص.xlsx" };

/** رفع ملف Excel بنفس شكل النموذج — السيرفر بيقراه ويرجّع الصفوف للمعاينة */
export function ExcelUpload({ kind, onRows }: Props) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const pick = (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", kind);
    start(async () => {
      const r = await parseRowsFileAction(fd);
      if (input.current) input.current.value = "";
      if (!r.ok) return toast.show(r.message, "err");
      onRows(r.data);
      toast.show(`تمت قراءة ${kind === "lines" ? r.data.lines.length : r.data.materials.length} صف من ${r.data.fileName}`, "ok");
    });
  };
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-md border-2 border-dashed border-bd2 bg-hover px-4 py-5"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        pick(e.dataTransfer.files[0]);
      }}
    >
      <FileSpreadsheet className="size-8 text-ok6" aria-hidden />
      <div className="min-w-[200px] flex-1">
        <b className="block">اسحب ملف Excel هنا أو اختره من جهازك</b>
        <span className="text-xs text-tx3">بنفس شكل النموذج — ورقة «{kind === "lines" ? "بنود المستخلص" : "مهمات المستخلص"}»</span>
      </div>
      <input ref={input} type="file" accept=".xlsx" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <Button variant="pr" disabled={pending} onClick={() => input.current?.click()}>
        <FileSpreadsheet /> {pending ? "جارٍ القراءة…" : "اختيار ملف"}
      </Button>
      <a href={`/templates/${TEMPLATES[kind]}`} download className={buttonClasses({ size: "sm", variant: "gh" })}>
        <Download /> تنزيل النموذج
      </a>
    </div>
  );
}
