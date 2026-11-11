-- CreateTable
CREATE TABLE "StudentSubjectLimit" (
    "email" TEXT NOT NULL,
    "maxSubjects" INTEGER NOT NULL,

    CONSTRAINT "StudentSubjectLimit_pkey" PRIMARY KEY ("email")
);
