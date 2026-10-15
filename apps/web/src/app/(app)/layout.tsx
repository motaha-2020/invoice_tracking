import type { ReactNode } from "react";
import { AppHeader } from "@/components/shell/app-header";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { ShellScrim } from "@/components/shell/shell-controls";

/**
 * الـ shell بتاع الصفحات اللي محتاجة دخول. الإطار نفسه static؛ أي حاجة بتقرا الجلسة
 * (بيانات المستخدم، القائمة، الإشعارات، محتوى الصفحة) جوه Suspense — Cache Components.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      <div className="flex min-h-[calc(100vh-60px)]">
        <AppSidebar />
        <main id="main" className="min-w-0 max-w-[1480px] flex-1 px-7 pt-6 pb-24 max-nav:px-4 max-nav:pt-4 max-sm:px-3 max-sm:pt-3">
          {children}
        </main>
      </div>
      <ShellScrim />
    </>
  );
}
