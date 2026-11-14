-- CreateTable
CREATE TABLE "StudentNotice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentNotice_active_createdAt_idx" ON "StudentNotice"("active", "createdAt");
