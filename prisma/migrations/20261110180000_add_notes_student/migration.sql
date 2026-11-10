-- CreateTable
CREATE TABLE "NotesStudent" (
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "altPhone" TEXT,
    "gmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotesStudent_pkey" PRIMARY KEY ("phone")
);
