// نقطة دخول الـ seed:
//   tsx prisma/seed.ts                 ← البيانات المرجعية + أول Admin (+ بيانات تجريبية لو SEED_DEMO=1)
//   tsx prisma/seed.ts --reference     ← البيانات المرجعية بس (اللي بتشتغل مع كل deploy في خدمة migrate)
// المتغيرات: DATABASE_URL، ADMIN_EMAIL، ADMIN_NAME، ADMIN_REISSUE، APP_URL، SEED_DEMO، SEED_DEMO_PASSWORD
import 'dotenv/config';
import { prisma } from '../src/index';
import { seedAdmin } from './seed/admin';
import { assertDemoEnv, seedDemo } from './seed/demo';
import { seedReference } from './seed/reference';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL مش متحدد');
  const referenceOnly = process.argv.includes('--reference');
  const withDemo = !referenceOnly && process.env.SEED_DEMO === '1';
  if (withDemo) assertDemoEnv();

  console.log('seed: البيانات المرجعية');
  await seedReference(prisma);
  if (referenceOnly) return;

  console.log('seed: أول Admin');
  await seedAdmin(prisma);

  if (withDemo) {
    console.log('seed: بيانات تجريبية (SEED_DEMO=1)');
    await seedDemo(prisma);
  }
}

main()
  .then(() => console.log('seed: تمام'))
  .catch((err: unknown) => {
    console.error('seed: فشل —', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
