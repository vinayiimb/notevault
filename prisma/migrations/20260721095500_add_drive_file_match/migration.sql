-- CreateTable
CREATE TABLE "DriveFileMatch" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "subjectId" TEXT,
    "driveFileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "webViewLink" TEXT NOT NULL,
    "year" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveFileMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriveFileMatch_subjectId_idx" ON "DriveFileMatch"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "DriveFileMatch_linkId_driveFileId_key" ON "DriveFileMatch"("linkId", "driveFileId");

-- AddForeignKey
ALTER TABLE "DriveFileMatch" ADD CONSTRAINT "DriveFileMatch_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "SessionProgramLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveFileMatch" ADD CONSTRAINT "DriveFileMatch_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
