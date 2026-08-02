-- DropIndex
DROP INDEX "SessionProgramLink_sessionId_programId_key";

-- AlterTable
ALTER TABLE "SessionProgramLink" ADD COLUMN     "variantLabel" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "SessionProgramLink_sessionId_programId_variantLabel_key" ON "SessionProgramLink"("sessionId", "programId", "variantLabel");
