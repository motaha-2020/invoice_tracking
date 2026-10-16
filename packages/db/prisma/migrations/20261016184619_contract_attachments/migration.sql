-- CreateTable
CREATE TABLE "contract_attachments" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "file_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_attachments_contract_id_idx" ON "contract_attachments"("contract_id");

-- AddForeignKey
ALTER TABLE "contract_attachments" ADD CONSTRAINT "contract_attachments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
