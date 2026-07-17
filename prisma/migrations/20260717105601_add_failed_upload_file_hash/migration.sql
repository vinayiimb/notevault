-- AlterTable
ALTER TABLE "FailedUpload" ADD COLUMN "fileHash" TEXT;

-- CreateIndex
CREATE INDEX "FailedUpload_fileHash_idx" ON "FailedUpload"("fileHash");
