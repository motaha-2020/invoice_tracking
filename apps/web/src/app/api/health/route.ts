import { prisma } from "@it/db";

/** فحص صحة الخدمة للـ Docker healthcheck و deploy.sh — بيتأكد إن قاعدة البيانات بترد */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
