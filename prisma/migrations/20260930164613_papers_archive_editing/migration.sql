-- AlterTable
ALTER TABLE "CatalogSubjectOverride" ADD COLUMN     "courseOverride" TEXT,
ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CatalogPaperOverride" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogPaperOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogPaperOverride_paperId_key" ON "CatalogPaperOverride"("paperId");
