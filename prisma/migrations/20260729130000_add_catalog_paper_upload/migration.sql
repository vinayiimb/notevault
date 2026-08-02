-- CreateTable
CREATE TABLE "CatalogPaperUpload" (
    "id" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "yearRange" TEXT NOT NULL,
    "semesterGroup" TEXT NOT NULL,
    "semester" INTEGER,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogPaperUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogPaperUpload_fileHash_key" ON "CatalogPaperUpload"("fileHash");

-- CreateIndex
CREATE INDEX "CatalogPaperUpload_course_subject_yearRange_idx" ON "CatalogPaperUpload"("course", "subject", "yearRange");
