-- CreateTable
CREATE TABLE "DuQuestionBankPaper" (
    "id" TEXT NOT NULL,
    "officialProgramme" TEXT NOT NULL,
    "semester" TEXT,
    "paperType" TEXT,
    "subjectPaperName" TEXT NOT NULL,
    "courseNumber" TEXT,
    "upc" TEXT,
    "credits" TEXT,
    "matchedCategories" TEXT,
    "sourceType" TEXT,
    "officialPageUrl" TEXT,
    "officialPaperLink" TEXT,
    "questionPaperLink" TEXT,
    "questionPaperSession" TEXT,
    "questionPaperYear" TEXT,
    "questionPaperSet" TEXT,
    "questionPaperMarks" TEXT,
    "matchSource" TEXT,
    "recoveredUpc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuQuestionBankPaper_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DuQuestionBankPaper_officialProgramme_idx" ON "DuQuestionBankPaper"("officialProgramme");

-- CreateIndex
CREATE INDEX "DuQuestionBankPaper_upc_idx" ON "DuQuestionBankPaper"("upc");
