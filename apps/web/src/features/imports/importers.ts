import "server-only";
/**
 * نقطة تحميل كل الـ importers — أي importer جديد يتضاف هنا بـ import واحد
 * (الملف بيسجّل نفسه بـ registerImporter).
 */
import "@/features/org/org.importer";        // 01 الهيكل التنظيمي
import "@/features/org/projects.importer";   // 02 المشروعات
import "@/features/org/companies.importer";  // 03 الشركات
import "@/features/users/users.importer";    // 04 المستخدمين
import "@/features/contracts/contract.importer"; // 05 العقد والمقايسة
import "@/features/contracts/ao.importer";   // 06 أمر التكليف
import "@/features/materials/materials.importer"; // 07 كتالوج المهمات
import "@/features/materials/issues.importer";    // 08 المنصرف
import "@/features/invoices/history.importer";    // 11 المستخلصات السابقة
import "@/features/workflow/holidays.importer";   // 12 الأجازات

