-- CreateTable
CREATE TABLE "TermPaper" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "year" INTEGER,
    "academicYear" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermPaper_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TermPaper_fileHash_idx" ON "TermPaper"("fileHash");

-- CreateIndex
CREATE INDEX "TermPaper_batchId_idx" ON "TermPaper"("batchId");

-- AddForeignKey
ALTER TABLE "TermPaper" ADD CONSTRAINT "TermPaper_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermPaper" ADD CONSTRAINT "TermPaper_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "UploadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
