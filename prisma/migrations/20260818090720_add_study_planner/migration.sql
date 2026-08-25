-- CreateEnum
CREATE TYPE "PlanStrategy" AS ENUM ('BALANCED', 'PYQ_FOCUSED', 'SYLLABUS_FIRST', 'WEAK_TOPICS_FIRST', 'LAST_MINUTE', 'SMART_DU');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PrepLevel" AS ENUM ('NOT_STARTED', 'BASIC', 'AVERAGE', 'STRONG');

-- CreateEnum
CREATE TYPE "TargetLevel" AS ENUM ('PASS', 'GOOD_SCORE', 'TOP_SCORE');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('LEARN', 'REVISE', 'SOLVE_PYQS', 'PRACTICE', 'ATTEMPT_PAPER', 'MOCK_TEST');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'SKIPPED', 'RESCHEDULED');

-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "hoursWeekday" INTEGER NOT NULL,
    "hoursWeekend" INTEGER NOT NULL,
    "preferredTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "studyDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "strategy" "PlanStrategy" NOT NULL DEFAULT 'SMART_DU',
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlanSubject" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "examTime" TEXT,
    "preparationLevel" "PrepLevel" NOT NULL DEFAULT 'NOT_STARTED',
    "targetLevel" "TargetLevel" NOT NULL DEFAULT 'GOOD_SCORE',

    CONSTRAINT "StudyPlanSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerTask" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "topic" TEXT,
    "type" "TaskType" NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "resourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyPlan_studentId_status_idx" ON "StudyPlan"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPlanSubject_planId_subjectId_key" ON "StudyPlanSubject"("planId", "subjectId");

-- CreateIndex
CREATE INDEX "PlannerTask_planId_scheduledDate_idx" ON "PlannerTask"("planId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlanSubject" ADD CONSTRAINT "StudyPlanSubject_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlanSubject" ADD CONSTRAINT "StudyPlanSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerTask" ADD CONSTRAINT "PlannerTask_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerTask" ADD CONSTRAINT "PlannerTask_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
