/**
 * attach-cli — رفع مرفقات العقود وأوامر التكليف بالجملة من ملف manifest (للتشغيل الأولي ونقل المستندات).
 * بيستخدم نفس خدمة الرفع بتاعة الشاشة (نفس التحقق من النوع والحجم والصلاحية)، وكل ملف بيتسجل في audit_log
 * باسم المستخدم المحدد بـ --as. الملف اللي اترفع قبل كده (نفس sha256 على نفس العقد/أمر التكليف) بيتجاهل.
 *
 * manifest.json: [{ "file": "مسار نسبي من فولدر الـ manifest", "name": "اسم الملف الأصلي"?, "contract": "232/2025/1/36", "ao": "PO25"?, "kind": "ao_letter", "note": "..."? }]
 *
 * على السيرفر (من /srv/invoices/app) — WITH_UPLOADS=1 بيربط volume المرفقات بتاع الـ web:
 *   WITH_UPLOADS=1 infra/run.sh npx tsx --conditions=react-server --tsconfig apps/web/tsconfig.json \
 *     apps/web/scripts/attach-cli.ts <manifest.json> --as <email> [--commit]
 *
 * من غير --commit: مراجعة بس (بيطبع اللي هيترفع).
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { prisma } from "@it/db";
import { uploadContractFile } from "@/features/contracts/contract-edit.service";

type Entry = { file: string; name?: string; contract: string; ao?: string; kind: string; note?: string };

async function main() {
  const [manifestPath, ...rest] = process.argv.slice(2);
  const email = rest[rest.indexOf("--as") + 1];
  const doCommit = rest.includes("--commit");
  if (!manifestPath || !rest.includes("--as") || !email) {
    throw new Error("الاستخدام: attach-cli <manifest.json> --as <email> [--commit]");
  }

  const u = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, active: true, roles: { select: { role: true, scopeType: true, scopeId: true } } },
  });
  if (!u || !u.active) throw new Error(`المستخدم ${email} غير موجود أو موقوف`);
  const user = { id: u.id, name: u.name, email: u.email, roles: u.roles };

  const base = dirname(resolve(manifestPath));
  const entries = JSON.parse(await readFile(manifestPath, "utf8")) as Entry[];
  const counts = { uploaded: 0, existing: 0, failed: 0 };

  for (const e of entries) {
    const fileName = e.name ?? basename(e.file);
    const label = `${e.contract}${e.ao ? ` / ${e.ao}` : ""} — ${fileName}`;
    try {
      const contract = await prisma.contract.findFirst({ where: { contractNo: e.contract }, select: { id: true } });
      if (!contract) throw new Error("العقد غير موجود");
      const ao = e.ao ? await prisma.assignmentOrder.findFirst({ where: { contractId: contract.id, aoNo: e.ao }, select: { id: true } }) : null;
      if (e.ao && !ao) throw new Error("أمر التكليف غير موجود");

      const data = await readFile(resolve(base, e.file));
      const sha256 = createHash("sha256").update(data).digest("hex");
      const dup = await prisma.contractAttachment.findFirst({ where: { contractId: contract.id, aoId: ao?.id ?? null, sha256 }, select: { id: true } });
      if (dup) {
        counts.existing++;
        continue;
      }
      if (doCommit) {
        await uploadContractFile(user, contract.id, new File([data], fileName), e.kind, e.note ?? null, ao?.id ?? null);
      }
      counts.uploaded++;
      console.log(`  ${doCommit ? "تم الرفع" : "سيُرفع"}: [${e.kind}] ${label}`);
    } catch (err) {
      counts.failed++;
      console.log(`  فشل: ${label}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`${doCommit ? "تم" : "مراجعة فقط"} — ${doCommit ? "مرفوع" : "للرفع"} ${counts.uploaded} | موجود مسبقاً ${counts.existing} | فشل ${counts.failed}`);
  if (counts.failed) process.exitCode = 1;
}

main()
  .catch((e: unknown) => {
    console.error("فشل:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
