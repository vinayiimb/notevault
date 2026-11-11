-- CreateTable
CREATE TABLE "StudentSubject" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "course" TEXT,
    "semester" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentSubject_email_idx" ON "StudentSubject"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSubject_email_name_key" ON "StudentSubject"("email", "name");
