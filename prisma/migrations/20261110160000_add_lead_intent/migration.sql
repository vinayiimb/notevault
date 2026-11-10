-- CreateTable
CREATE TABLE "LeadIntent" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "programme" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "semester" INTEGER,
    "phone" TEXT,
    "yesAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chatAt" TIMESTAMP(3),
    "waAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadIntent_visitorId_key_key" ON "LeadIntent"("visitorId", "key");

-- CreateIndex
CREATE INDEX "LeadIntent_createdAt_idx" ON "LeadIntent"("createdAt");

-- CreateIndex
CREATE INDEX "LeadIntent_phone_idx" ON "LeadIntent"("phone");
