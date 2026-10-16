-- مرفقات أمر التكليف: نفس جدول مرفقات العقد مع ربط اختياري بأمر التكليف
ALTER TABLE "contract_attachments" ADD COLUMN "ao_id" TEXT;

-- CreateIndex
CREATE INDEX "contract_attachments_ao_id_idx" ON "contract_attachments"("ao_id");

-- AddForeignKey
ALTER TABLE "contract_attachments" ADD CONSTRAINT "contract_attachments_ao_id_fkey" FOREIGN KEY ("ao_id") REFERENCES "assignment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
