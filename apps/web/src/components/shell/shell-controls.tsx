"use client";

import { Moon, PanelRight, Sun } from "lucide-react";

/**
 * حالة الـ shell متخزنة كـ attributes على <html> (data-theme / data-sidebar / data-nav)
 * والـ CSS variants بتقراها — فمفيش React state ومفيش hydration mismatch.
 * القيم المحفوظة بتتطبق قبل أول رسم من الـ inline script في app/layout.tsx.
 */
const MOBILE = "(max-width: 860px)";

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // private mode / storage مقفول — مش مشكلة
  }
}

export function closeMobileNav() {
  document.documentElement.removeAttribute("data-nav");
}

const iconBtn =
  "relative grid h-[34px] w-9 cursor-pointer place-items-center rounded-base border-0 bg-white/12 text-white transition-colors duration-150 ease-we hover:bg-white/20 max-sm:w-8";

export function SidebarToggle() {
  return (
    <button
      type="button"
      className={iconBtn}
      aria-label="القائمة"
      aria-controls="app-sidebar"
      onClick={() => {
        const root = document.documentElement;
        if (window.matchMedia(MOBILE).matches) {
          if (root.dataset.nav === "open") closeMobileNav();
          else root.dataset.nav = "open";
          return;
        }
        const collapsed = root.dataset.sidebar === "collapsed";
        if (collapsed) root.removeAttribute("data-sidebar");
        else root.dataset.sidebar = "collapsed";
        store("sidebar", collapsed ? null : "collapsed");
      }}
    >
      <PanelRight className="size-4" strokeWidth={1.75} aria-hidden />
    </button>
  );
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      className={iconBtn}
      aria-label="تبديل الوضع الداكن"
      onClick={() => {
        const root = document.documentElement;
        const dark =
          root.dataset.theme === "dark" || (!root.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
        root.dataset.theme = dark ? "light" : "dark";
        store("theme", root.dataset.theme);
      }}
    >
      <Moon className="size-4 dark:hidden" strokeWidth={1.75} aria-hidden />
      <Sun className="hidden size-4 dark:block" strokeWidth={1.75} aria-hidden />
    </button>
  );
}

/** خلفية القائمة على الموبايل — ضغطة عليها بتقفل */
export function ShellScrim() {
  return (
    <div
      aria-hidden
      onClick={closeMobileNav}
      className="fixed inset-x-0 top-[60px] bottom-0 z-34 hidden bg-scrim max-nav:navopen:block"
    />
  );
}
