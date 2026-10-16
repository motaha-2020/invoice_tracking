/**
 * import-cli — استيراد نموذج Excel من سطر الأوامر (للتشغيل الأولي ونقل البيانات بالجملة).
 * بيستخدم نفس محرك الاستيراد ونفس قواعد التحقق بتاعة الشاشة، وبيتسجل في import_batches و audit_log
 * باسم المستخدم المحدد بـ --as (لازم يكون عنده صلاحية النموذج).
 *
 * على السيرفر (من /srv/invoices/app):
 *   infra/run.sh npx tsx --conditions=react-server --tsconfig apps/web/tsconfig.json \
 *     apps/web/scripts/import-cli.ts <template_id> <file.xlsx> --as <email> [--commit]
 *
 * من غير --commit: مراجعة بس (زي زرار "رفع ومراجعة"). مع --commit: اعتماد الصفوف السليمة.
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { prisma } from "@it/db";
import { commitImport, previewImport } from "@/features/imports/import.service";

async function main() {
  const [templateId, filePath, ...rest] = process.argv.slice(2);
  const email = rest[rest.indexOf("--as") + 1];
  const doCommit = rest.includes("--commit");
  if (!templateId || !filePath || !rest.includes("--as") || !email) {
    throw new Error("الاستخدام: import-cli <template_id> <file.xlsx> --as <email> [--commit]");
  }

  const u = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, active: true, roles: { select: { role: true, scopeType: true, scopeId: true } } },
  });
  if (!u || !u.active) throw new Error(`المستخدم ${email} غير موجود أو موقوف`);
  const user = { id: u.id, name: u.name, email: u.email, roles: u.roles };

  const buf = await readFile(filePath);
  const file = new File([buf], basename(filePath), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const p = await previewImport(templateId, file, { user });

  console.log(`المراجعة: ${p.title} — جديد ${p.counts.create} | تحديث ${p.counts.update} | متجاهل ${p.counts.skip} | أخطاء ${p.counts.error} | تحذيرات ${p.counts.warnings}`);
  p.notes.forEach((n) => console.log(`  ملاحظة: ${n}`));
  for (const r of p.rows.filter((x) => x.errors.length || x.warnings.length)) {
    console.log(`  [${r.sheet} ص${r.row}] ${r.status} — ${r.label}: ${[...r.errors, ...r.warnings].join(" | ")}`);
  }

  if (!doCommit) {
    console.log("مراجعة فقط — لم يتم الحفظ (أضف --commit للاعتماد).");
    return;
  }
  const res = await commitImport(p.batchId, { user });
  console.log(`تم الاعتماد: ${res.message}`, res.counts);
}

main()
  .catch((e: unknown) => {
    console.error("فشل:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
