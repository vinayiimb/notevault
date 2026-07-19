-- CreateTable
CREATE TABLE "CourseMatchMemory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseMatchMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseMatchMemory_key_key" ON "CourseMatchMemory"("key");
