import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "منظومة تتبع المستخلصات", template: "%s · تتبع المستخلصات" },
  description: "متابعة مستخلصات المقاولين من التقديم لحد الصرف — المصرية للاتصالات",
  icons: { icon: "/we-mark.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#5c2d91",
};

// بيطبق الوضع الداكن وحالة القائمة المحفوظين قبل أول رسم (من غير flash)
const restoreUiState = `try{var d=document.documentElement,s=localStorage,t=s.getItem("theme");if(t==="dark"||t==="light")d.dataset.theme=t;if(s.getItem("sidebar")==="collapsed")d.dataset.sidebar="collapsed"}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: restoreUiState }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
