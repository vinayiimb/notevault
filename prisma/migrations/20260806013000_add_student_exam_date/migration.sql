-- CreateTable
CREATE TABLE "StudentExamDate" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT,
    "subjectName" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "examTime" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentExamDate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentExamDate_studentId_idx" ON "StudentExamDate"("studentId");

-- AddForeignKey
ALTER TABLE "StudentExamDate" ADD CONSTRAINT "StudentExamDate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExamDate" ADD CONSTRAINT "StudentExamDate_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
