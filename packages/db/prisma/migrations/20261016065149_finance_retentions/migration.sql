-- المرحلة 4 (الماليات): مراجعة الاستقطاعات وصرف المبالغ المحتجزة. كله إضافة (nullable / default) — آمن مع الكود القديم.

-- AlterEnum
ALTER TYPE "step_action" ADD VALUE 'retention';

-- AlterTable
ALTER TABLE "invoice_deductions" ADD COLUMN     "note" TEXT,
ADD COLUMN     "release_method" TEXT,
ADD COLUMN     "release_note" TEXT,
ADD COLUMN     "released_by_id" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "deductions_set" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "invoice_deductions_releasable_released_at_idx" ON "invoice_deductions"("releasable", "released_at");

-- AddForeignKey
ALTER TABLE "invoice_deductions" ADD CONSTRAINT "invoice_deductions_released_by_id_fkey" FOREIGN KEY ("released_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
