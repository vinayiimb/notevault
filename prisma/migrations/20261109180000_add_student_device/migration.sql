-- CreateTable
CREATE TABLE "StudentDevice" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "StudentDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentDevice_email_revokedAt_idx" ON "StudentDevice"("email", "revokedAt");
