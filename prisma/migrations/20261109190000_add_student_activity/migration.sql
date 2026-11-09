-- CreateTable
CREATE TABLE "StudentActivity" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "opens" INTEGER NOT NULL DEFAULT 0,
    "maxScroll" INTEGER NOT NULL DEFAULT 0,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentHour" (
    "email" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StudentHour_pkey" PRIMARY KEY ("email","hour")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentActivity_email_day_itemKey_key" ON "StudentActivity"("email", "day", "itemKey");

-- CreateIndex
CREATE INDEX "StudentActivity_email_lastAt_idx" ON "StudentActivity"("email", "lastAt");

-- CreateIndex
CREATE INDEX "StudentActivity_lastAt_idx" ON "StudentActivity"("lastAt");
