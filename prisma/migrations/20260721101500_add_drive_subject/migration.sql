-- DropForeignKey
ALTER TABLE "DriveFileMatch" DROP CONSTRAINT "DriveFileMatch_subjectId_fkey";

-- DropIndex
DROP INDEX "DriveFileMatch_subjectId_idx";

-- AlterTable
ALTER TABLE "DriveFileMatch" DROP COLUMN "subjectId",
ADD COLUMN     "driveSubjectId" TEXT;

-- CreateTable
CREATE TABLE "DriveSubject" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriveSubject_programId_slug_key" ON "DriveSubject"("programId", "slug");

-- CreateIndex
CREATE INDEX "DriveFileMatch_driveSubjectId_idx" ON "DriveFileMatch"("driveSubjectId");

-- AddForeignKey
ALTER TABLE "DriveSubject" ADD CONSTRAINT "DriveSubject_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveFileMatch" ADD CONSTRAINT "DriveFileMatch_driveSubjectId_fkey" FOREIGN KEY ("driveSubjectId") REFERENCES "DriveSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
