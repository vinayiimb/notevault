-- AlterTable
ALTER TABLE "Resource" ADD COLUMN "fileHash" TEXT;

-- CreateTable
CREATE TABLE "FailedUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "year" INTEGER,
    "reason" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Resource_fileHash_idx" ON "Resource"("fileHash");
