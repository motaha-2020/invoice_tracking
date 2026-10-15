import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

export * from './generated/prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Prisma client واحد للتطبيق كله (في dev بيتحفظ على globalThis عشان hot reload) */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
