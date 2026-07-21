-- AlterTable
ALTER TABLE "Subject" DROP COLUMN "questionPaperUrl";

-- CreateTable
CREATE TABLE "ExamSession" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "masterDriveUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionProgramLink" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "driveUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionProgramLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamSession_label_key" ON "ExamSession"("label");

-- CreateIndex
CREATE UNIQUE INDEX "SessionProgramLink_sessionId_programId_key" ON "SessionProgramLink"("sessionId", "programId");

-- AddForeignKey
ALTER TABLE "SessionProgramLink" ADD CONSTRAINT "SessionProgramLink_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProgramLink" ADD CONSTRAINT "SessionProgramLink_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
