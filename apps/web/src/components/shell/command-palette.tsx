"use client";

import { Search, SearchX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { NavIconName } from "@/features/shell/nav";
import { NAV_ICONS } from "./nav-icons";

export type PaletteItem = { href: string; label: string; icon: NavIconName };

/**
 * Ctrl+K: بحث سريع. دلوقتي الصفحات بس؛ البحث في المستخلصات والعقود هيتضاف لما الـ API بتاعه يجهز.
 */
export function CommandPalette({ items }: { items: PaletteItem[] }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  const results = items.filter((it) => !q.trim() || it.label.includes(q.trim()));

  function open() {
    setQ("");
    setIdx(0);
    dialogRef.current?.showModal();
    inputRef.current?.focus();
  }

  function close() {
    dialogRef.current?.close();
  }

  function go(href: string) {
    close();
    router.push(href);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialogRef.current?.open) dialogRef.current.close();
        else {
          setQ("");
          setIdx(0);
          dialogRef.current?.showModal();
          inputRef.current?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="flex h-[34px] min-w-[260px] cursor-pointer items-center gap-2 rounded-base border border-white/18 bg-white/12 px-2.5 text-white/85 max-xl:min-w-0 max-nav:w-9 max-nav:justify-center max-nav:px-0"
        aria-label="بحث"
      >
        <Search className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="max-xl:hidden">ابحث عن صفحة…</span>
        <kbd className="ms-auto rounded-[3px] bg-white/16 px-1.5 font-[inherit] text-[11px] max-xl:hidden">Ctrl K</kbd>
      </button>

      <dialog
        ref={dialogRef}
        aria-label="بحث سريع"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="mx-auto mt-[12vh] w-[min(620px,calc(100%-32px))] overflow-hidden rounded-lg border-0 bg-card p-0 text-tx shadow-overlay"
      >
        <div className="flex items-center gap-2.5 border-b border-bd1 px-4">
          <Search className="size-4 text-tx3" strokeWidth={1.75} aria-hidden />
          <input
            ref={inputRef}
            value={q}
            placeholder="اكتب اسم صفحة…"
            className="h-[52px] flex-1 border-0 bg-transparent text-[15px] outline-0"
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              const n = results.length;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => (i + 1) % Math.max(n, 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => (i - 1 + n) % Math.max(n, 1));
              } else if (e.key === "Enter" && n > 0) {
                e.preventDefault();
                go(results[Math.min(idx, n - 1)]!.href);
              }
            }}
          />
        </div>
        <div className="max-h-[52vh] overflow-auto p-1.5" role="listbox">
          {results.length > 0 ? (
            <>
              <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold text-tx4">الصفحات</div>
              {results.map((r, i) => {
                const Icon = NAV_ICONS[r.icon];
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === idx}
                    key={r.href + r.label}
                    onMouseEnter={() => setIdx(i)}
                    onClick={() => go(r.href)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2.5 rounded-base border-0 bg-transparent px-2.5 py-[9px] text-start",
                      i === idx && "bg-sel text-brand-tx",
                    )}
                  >
                    <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                    <span>{r.label}</span>
                    <small className="ms-auto text-xs text-tx3">صفحة</small>
                  </button>
                );
              })}
            </>
          ) : (
            <div className="px-5 py-8 text-center text-tx3">
              <SearchX className="mx-auto mb-2 size-6" aria-hidden />
              مفيش نتائج
            </div>
          )}
        </div>
        <div className="flex gap-3.5 border-t border-bd1 px-3.5 py-2 text-[11px] text-tx3">
          <span>
            <kbd className="rounded-[3px] bg-sunken px-1">↑</kbd> <kbd className="rounded-[3px] bg-sunken px-1">↓</kbd> تنقل
          </span>
          <span>
            <kbd className="rounded-[3px] bg-sunken px-1">Enter</kbd> فتح
          </span>
          <span>
            <kbd className="rounded-[3px] bg-sunken px-1">Esc</kbd> إغلاق
          </span>
        </div>
      </dialog>
    </>
  );
}
