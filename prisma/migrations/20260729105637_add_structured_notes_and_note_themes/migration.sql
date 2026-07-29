-- CreateEnum
CREATE TYPE "NoteContentFormat" AS ENUM ('MARKDOWN', 'STRUCTURED');

-- CreateEnum
CREATE TYPE "NoteThemeScope" AS ENUM ('GLOBAL', 'SUBJECT', 'NOTE');

-- AlterTable
ALTER TABLE "SubjectNotes" ADD COLUMN     "format" "NoteContentFormat" NOT NULL DEFAULT 'MARKDOWN',
ADD COLUMN     "sourceFileName" TEXT,
ADD COLUMN     "sourceFileUrl" TEXT,
ADD COLUMN     "structuredJson" JSONB;

-- CreateTable
CREATE TABLE "NoteTheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "NoteThemeScope" NOT NULL,
    "subjectId" TEXT,
    "subjectNotesId" TEXT,
    "isPreset" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultGlobal" BOOLEAN NOT NULL DEFAULT false,
    "draftJson" JSONB NOT NULL,
    "publishedJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteThemeVersion" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteThemeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NoteTheme_subjectNotesId_key" ON "NoteTheme"("subjectNotesId");

-- CreateIndex
CREATE INDEX "NoteTheme_scope_idx" ON "NoteTheme"("scope");

-- CreateIndex
CREATE INDEX "NoteTheme_subjectId_idx" ON "NoteTheme"("subjectId");

-- CreateIndex
CREATE INDEX "NoteThemeVersion_themeId_idx" ON "NoteThemeVersion"("themeId");

-- AddForeignKey
ALTER TABLE "NoteTheme" ADD CONSTRAINT "NoteTheme_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTheme" ADD CONSTRAINT "NoteTheme_subjectNotesId_fkey" FOREIGN KEY ("subjectNotesId") REFERENCES "SubjectNotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteThemeVersion" ADD CONSTRAINT "NoteThemeVersion_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "NoteTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
