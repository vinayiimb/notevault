-- CreateTable
CREATE TABLE "CanonicalSubjectNote" (
    "id" TEXT NOT NULL,
    "programmeSlug" TEXT NOT NULL,
    "programme" TEXT NOT NULL,
    "subjectSlug" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'sky',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanonicalSubjectNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CanonicalSubjectNote_programmeSlug_idx" ON "CanonicalSubjectNote"("programmeSlug");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalSubjectNote_programmeSlug_subjectSlug_key" ON "CanonicalSubjectNote"("programmeSlug", "subjectSlug");
