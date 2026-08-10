-- These were added to schema.prisma for the Bulk Upload "Fresh Upload" flow
-- but a migration was never generated/committed for them (only pushed to a
-- dev database directly), which is why production was missing them despite
-- `prisma migrate deploy` reporting nothing pending.

-- CreateEnum
CREATE TYPE "BulkUploadRowStatus" AS ENUM ('VALID', 'IMPORTED', 'SKIPPED', 'DUPLICATE', 'INVALID');

-- AlterTable
ALTER TABLE "UploadBatch" ADD COLUMN     "sourceFileName" TEXT;

-- CreateTable
CREATE TABLE "BulkUploadRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "BulkUploadRowStatus" NOT NULL,
    "message" TEXT,
    "courseRaw" TEXT NOT NULL,
    "subjectRaw" TEXT NOT NULL,
    "yearRangeRaw" TEXT,
    "semesterGroupRaw" TEXT,
    "semesterRaw" TEXT,
    "fileUrlRaw" TEXT,
    "fileNameRaw" TEXT,
    "noteRaw" TEXT,
    "catalogPaperUploadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkUploadRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BulkUploadRow_catalogPaperUploadId_key" ON "BulkUploadRow"("catalogPaperUploadId");

-- CreateIndex
CREATE INDEX "BulkUploadRow_batchId_idx" ON "BulkUploadRow"("batchId");

-- CreateIndex
CREATE INDEX "BulkUploadRow_status_idx" ON "BulkUploadRow"("status");

-- AddForeignKey
ALTER TABLE "BulkUploadRow" ADD CONSTRAINT "BulkUploadRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "UploadBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkUploadRow" ADD CONSTRAINT "BulkUploadRow_catalogPaperUploadId_fkey" FOREIGN KEY ("catalogPaperUploadId") REFERENCES "CatalogPaperUpload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
