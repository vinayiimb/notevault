-- CreateTable
CREATE TABLE "SubjectAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    "compiledNotes" TEXT NOT NULL,
    "mostRepeatedJson" TEXT NOT NULL,
    "predictedPaperJson" TEXT NOT NULL,
    "sourceResourceCount" INTEGER NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubjectAnalysis_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "heroHeadline" TEXT,
    "heroSubtitle" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SubjectAnalysis_subjectId_key" ON "SubjectAnalysis"("subjectId");
