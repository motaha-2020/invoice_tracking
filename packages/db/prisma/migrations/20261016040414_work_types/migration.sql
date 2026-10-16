-- أنواع الأعمال (work_types) بدل الـ enum invoice_kind.
-- العمود الجديد nullable فمفيش صف بيقع، وبعدين kind بيتشال. مفيش backfill: الإنتاج لسه مفيهوش مستخلصات،
-- وأنواع الأعمال نفسها بتتزرع من seed المرجعي بعد الـ migration.

-- CreateTable
CREATE TABLE "work_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_planning" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "work_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_types_code_key" ON "work_types"("code");

-- AlterTable: add the new nullable column first, then drop the old enum column
ALTER TABLE "invoices" ADD COLUMN "work_type_id" TEXT;
ALTER TABLE "invoices" DROP COLUMN "kind";

-- DropEnum
DROP TYPE "invoice_kind";

-- CreateIndex
CREATE INDEX "invoices_work_type_id_idx" ON "invoices"("work_type_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_work_type_id_fkey" FOREIGN KEY ("work_type_id") REFERENCES "work_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
