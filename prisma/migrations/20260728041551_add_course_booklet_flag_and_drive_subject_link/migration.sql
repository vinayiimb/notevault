-- AlterTable
ALTER TABLE "DriveFileMatch" ADD COLUMN     "isCourseBooklet" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DriveSubject" ADD COLUMN     "subjectId" TEXT;

-- CreateIndex
CREATE INDEX "DriveSubject_subjectId_idx" ON "DriveSubject"("subjectId");

-- AddForeignKey
ALTER TABLE "DriveSubject" ADD CONSTRAINT "DriveSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
