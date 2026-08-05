-- CreateEnum
CREATE TYPE "AliasSource" AS ENUM ('IMPORT', 'ADMIN', 'AI');

-- CreateEnum
CREATE TYPE "SubjectRelationship" AS ENUM ('EXACT_DUPLICATE', 'SPELLING_VARIATION', 'ABBREVIATION', 'RENAMED_SYLLABUS', 'RELATED_BUT_SEPARATE');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'IGNORED', 'MERGED');

-- CreateEnum
CREATE TYPE "ScanScope" AS ENUM ('ALL', 'PROGRAM', 'TERM', 'UNMAPPED', 'SELECTED');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "mergedIntoId" TEXT,
ADD COLUMN     "parentSubjectId" TEXT;

-- CreateTable
CREATE TABLE "SubjectAlias" (
    "id" TEXT NOT NULL,
    "canonicalSubjectId" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "source" "AliasSource" NOT NULL DEFAULT 'ADMIN',
    "confidenceScore" INTEGER,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectMergeSuggestion" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "suggestedName" TEXT NOT NULL,
    "subjectIds" TEXT[],
    "confidenceScore" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "relationship" "SubjectRelationship" NOT NULL,
    "safeToMerge" BOOLEAN NOT NULL DEFAULT true,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" "AliasSource" NOT NULL DEFAULT 'AI',
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectMergeSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectMergeLog" (
    "id" TEXT NOT NULL,
    "previousCanonicalSubjectId" TEXT NOT NULL,
    "newCanonicalSubjectId" TEXT NOT NULL,
    "affectedResourceIds" TEXT[],
    "affectedQuestionIds" TEXT[],
    "reassignments" JSONB NOT NULL,
    "administrator" TEXT NOT NULL,
    "confidenceScore" INTEGER,
    "reason" TEXT,
    "isAiAssisted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),
    "undoneBy" TEXT,

    CONSTRAINT "SubjectMergeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanRun" (
    "id" TEXT NOT NULL,
    "scope" "ScanScope" NOT NULL,
    "programId" TEXT,
    "termId" TEXT,
    "status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "totalSubjects" INTEGER NOT NULL DEFAULT 0,
    "processedSubjects" INTEGER NOT NULL DEFAULT 0,
    "groupsFound" INTEGER NOT NULL DEFAULT 0,
    "suggestionsCreated" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubjectAlias_normalizedName_idx" ON "SubjectAlias"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectAlias_canonicalSubjectId_normalizedName_key" ON "SubjectAlias"("canonicalSubjectId", "normalizedName");

-- CreateIndex
CREATE INDEX "SubjectMergeSuggestion_termId_idx" ON "SubjectMergeSuggestion"("termId");

-- CreateIndex
CREATE INDEX "SubjectMergeSuggestion_status_idx" ON "SubjectMergeSuggestion"("status");

-- CreateIndex
CREATE INDEX "SubjectMergeSuggestion_confidenceScore_idx" ON "SubjectMergeSuggestion"("confidenceScore");

-- CreateIndex
CREATE INDEX "SubjectMergeLog_previousCanonicalSubjectId_idx" ON "SubjectMergeLog"("previousCanonicalSubjectId");

-- CreateIndex
CREATE INDEX "SubjectMergeLog_newCanonicalSubjectId_idx" ON "SubjectMergeLog"("newCanonicalSubjectId");

-- CreateIndex
CREATE INDEX "ScanRun_status_idx" ON "ScanRun"("status");

-- CreateIndex
CREATE INDEX "Subject_parentSubjectId_idx" ON "Subject"("parentSubjectId");

-- CreateIndex
CREATE INDEX "Subject_mergedIntoId_idx" ON "Subject"("mergedIntoId");

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_parentSubjectId_fkey" FOREIGN KEY ("parentSubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectAlias" ADD CONSTRAINT "SubjectAlias_canonicalSubjectId_fkey" FOREIGN KEY ("canonicalSubjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectMergeSuggestion" ADD CONSTRAINT "SubjectMergeSuggestion_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

