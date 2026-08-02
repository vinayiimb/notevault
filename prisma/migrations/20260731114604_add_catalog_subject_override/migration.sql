-- CreateTable
CREATE TABLE "CatalogSubjectOverride" (
    "id" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "displayName" TEXT,
    "semesterOverride" INTEGER,
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogSubjectOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogSubjectOverride_course_subjectKey_key" ON "CatalogSubjectOverride"("course", "subjectKey");
