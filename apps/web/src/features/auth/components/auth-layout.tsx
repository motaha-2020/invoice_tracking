import { FileDown, FileSpreadsheet, GitBranch, ShieldCheck } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

/** صفحة الدخول/الدعوة: لوحة البراند (static) + الفورم */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-2 bg-bg max-nav:grid-cols-1">
      <div className="flex flex-col justify-between bg-p900 p-12 text-white max-nav:hidden">
        <Image src="/we-mark-white.png" alt="WE" width={48} height={48} priority className="h-12 w-auto self-start" />
        <div>
          <h1 className="m-0 mb-3 text-[34px] leading-tight font-bold">المستخلص من التقديم لحد الصرف، في مكان واحد</h1>
          <p className="m-0 max-w-[440px] text-white/75">
            الشركة تقدّم وتتابع، وكل إدارة تعتمد أو ترجّع بسبب واضح، والسيستم يعدّ أيام العمل ويبعت الإيميلات.
          </p>
          <ul className="m-0 mt-6 grid list-none gap-2.5 p-0">
            {[
              { icon: FileSpreadsheet, t: "بنود ومهمات من Excel والأسعار من العقد" },
              { icon: GitBranch, t: "مسار حسب فئة التجاوز C1–C5" },
              { icon: ShieldCheck, t: "كل مستخدم يشوف نطاقه بس" },
              { icon: FileDown, t: "تقارير وتصدير بأي فلتر" },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex items-center gap-2.5 text-white/85">
                <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-xs opacity-60">إدارة المتابعة PMO · المصرية للاتصالات</div>
      </div>
      <div className="grid place-items-center p-6">
        <div className="w-[min(460px,100%)]">{children}</div>
      </div>
    </div>
  );
}
