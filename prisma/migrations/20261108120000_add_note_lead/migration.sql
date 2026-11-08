-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'DROPPED');

-- CreateTable
CREATE TABLE "NoteLead" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "programmeSlug" TEXT NOT NULL,
    "programme" TEXT NOT NULL,
    "semester" INTEGER,
    "subjectSlug" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "hasNotes" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactedAt" TIMESTAMP(3),

    CONSTRAINT "NoteLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoteLead_status_createdAt_idx" ON "NoteLead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "NoteLead_phone_idx" ON "NoteLead"("phone");
