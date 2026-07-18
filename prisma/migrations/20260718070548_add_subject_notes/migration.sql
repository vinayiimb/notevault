-- CreateTable
CREATE TABLE "SubjectNotes" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectNotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubjectNotes_subjectId_key" ON "SubjectNotes"("subjectId");

-- AddForeignKey
ALTER TABLE "SubjectNotes" ADD CONSTRAINT "SubjectNotes_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
