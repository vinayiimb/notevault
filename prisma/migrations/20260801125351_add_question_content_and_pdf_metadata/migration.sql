-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('NOT_STARTED', 'PROCESSING', 'COMPLETED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "contentBlocks" JSONB,
ADD COLUMN     "difficulty" "QuestionDifficulty",
ADD COLUMN     "questionNumber" TEXT,
ADD COLUMN     "rawOcrText" TEXT,
ADD COLUMN     "section" TEXT,
ADD COLUMN     "topics" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "duration" TEXT,
ADD COLUMN     "maximumMarks" INTEGER,
ADD COLUMN     "ocrStatus" "OcrStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "paperCode" TEXT,
ADD COLUMN     "session" TEXT;

-- CreateTable
CREATE TABLE "ContentBlock" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "block" JSONB NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentBlock_category_idx" ON "ContentBlock"("category");
