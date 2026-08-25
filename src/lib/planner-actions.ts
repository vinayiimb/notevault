"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureStudentWritable, awardPlannerTaskCompletion } from "@/lib/student";
import {
  getPlannerSubjectInsight,
  scoreAndGenerateTasks,
  type PlanInput,
  type PlanSubjectInput,
} from "@/lib/planner-data";

export type CreatePlanInput = {
  programId: string;
  termId: string;
  hoursWeekday: number;
  hoursWeekend: number;
  preferredTimes: string[];
  studyDays: string[];
  strategy: PlanInput["strategy"];
  subjects: {
    subjectId: string;
    examDate: string; // ISO date
    examTime?: string | null;
    preparationLevel: PlanSubjectInput["preparationLevel"];
    targetLevel: PlanSubjectInput["targetLevel"];
  }[];
};

export async function createPlanAction(input: CreatePlanInput) {
  if (input.subjects.length === 0) throw new Error("Select at least one subject to plan for.");
  const student = await ensureStudentWritable();

  // Only one ACTIVE plan per student at a time — older ones stay around as history.
  await prisma.studyPlan.updateMany({
    where: { studentId: student.id, status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });

  const plan = await prisma.studyPlan.create({
    data: {
      studentId: student.id,
      programId: input.programId,
      termId: input.termId,
      hoursWeekday: input.hoursWeekday,
      hoursWeekend: input.hoursWeekend,
      preferredTimes: input.preferredTimes,
      studyDays: input.studyDays,
      strategy: input.strategy,
      subjects: {
        create: input.subjects.map((s) => ({
          subjectId: s.subjectId,
          examDate: new Date(s.examDate),
          examTime: s.examTime ?? null,
          preparationLevel: s.preparationLevel,
          targetLevel: s.targetLevel,
        })),
      },
    },
    include: { subjects: { include: { subject: { select: { id: true, name: true } } } } },
  });

  const insights = new Map(
    await Promise.all(
      plan.subjects.map(async (ps) => [ps.subjectId, await getPlannerSubjectInsight(ps.subjectId)] as const)
    )
  );

  const planSubjectInputs: PlanSubjectInput[] = plan.subjects.map((ps) => ({
    subjectId: ps.subjectId,
    subjectName: ps.subject.name,
    examDate: ps.examDate,
    preparationLevel: ps.preparationLevel,
    targetLevel: ps.targetLevel,
  }));

  const generated = scoreAndGenerateTasks(
    {
      hoursWeekday: plan.hoursWeekday,
      hoursWeekend: plan.hoursWeekend,
      studyDays: plan.studyDays,
      strategy: plan.strategy,
    },
    planSubjectInputs,
    insights
  );

  if (generated.length > 0) {
    await prisma.plannerTask.createMany({
      data: generated.map((t) => ({
        planId: plan.id,
        subjectId: t.subjectId,
        topic: t.topic,
        type: t.type,
        title: t.title,
        scheduledDate: t.scheduledDate,
        estimatedMinutes: t.estimatedMinutes,
        priority: t.priority,
        resourceUrl: t.resourceUrl,
      })),
    });
  }

  revalidatePath("/planner");
  return { planId: plan.id, taskCount: generated.length };
}

export async function resumePlanAction(planId: string) {
  const student = await ensureStudentWritable();
  const plan = await prisma.studyPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.studentId !== student.id) throw new Error("Plan not found.");

  await prisma.studyPlan.updateMany({
    where: { studentId: student.id, status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });
  await prisma.studyPlan.update({ where: { id: planId }, data: { status: "ACTIVE" } });

  revalidatePath("/planner");
}

async function requireOwnedTask(taskId: string, studentId: string) {
  const task = await prisma.plannerTask.findUnique({
    where: { id: taskId },
    include: { plan: true },
  });
  if (!task || task.plan.studentId !== studentId) throw new Error("Task not found.");
  return task;
}

export async function updateTaskStatusAction(taskId: string, status: "IN_PROGRESS" | "DONE" | "SKIPPED") {
  const student = await ensureStudentWritable();
  await requireOwnedTask(taskId, student.id);

  await prisma.plannerTask.update({ where: { id: taskId }, data: { status } });

  if (status === "DONE") {
    try {
      await awardPlannerTaskCompletion();
    } catch {
      // Rewards are secondary — never block a task being marked done.
    }
  }

  revalidatePath("/planner");
}

const DAY_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const SESSION_SIZES = [90, 60, 45, 25] as const;
const RESCHEDULE_SEARCH_DAYS = 14;

// §12 — redistribute a missed/skipped task across the next few study days
// without exceeding the plan's daily hour cap. Splits into multiple smaller
// chunks (still snapped to the fixed session sizes) when one day can't
// absorb the whole thing.
export async function rescheduleTaskAction(taskId: string) {
  const student = await ensureStudentWritable();
  const task = await requireOwnedTask(taskId, student.id);
  const plan = await prisma.studyPlan.findUniqueOrThrow({
    where: { id: task.planId },
    include: { tasks: { where: { status: { in: ["TODO", "IN_PROGRESS"] } } } },
  });

  let remaining = task.estimatedMinutes;
  const today = new Date();
  const created: { scheduledDate: Date; minutes: number }[] = [];

  for (let offset = 1; offset <= RESCHEDULE_SEARCH_DAYS && remaining >= 25; offset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    const dayCode = DAY_CODES[date.getDay()];
    if (!plan.studyDays.includes(dayCode)) continue;

    const isWeekend = dayCode === "sat" || dayCode === "sun";
    const dailyCap = (isWeekend ? plan.hoursWeekend : plan.hoursWeekday) * 60;
    const committed = plan.tasks
      .filter((t) => new Date(t.scheduledDate).toDateString() === date.toDateString())
      .reduce((sum, t) => sum + t.estimatedMinutes, 0);
    const capacity = dailyCap - committed;
    if (capacity < 25) continue;

    const chunk = SESSION_SIZES.find((size) => size <= Math.min(capacity, remaining));
    if (!chunk) continue;

    created.push({ scheduledDate: date, minutes: chunk });
    remaining -= chunk;
  }

  if (created.length === 0) {
    throw new Error("Couldn't find room in the next two weeks — try increasing your daily study hours.");
  }

  await prisma.$transaction([
    prisma.plannerTask.update({ where: { id: task.id }, data: { status: "RESCHEDULED" } }),
    prisma.plannerTask.createMany({
      data: created.map((c) => ({
        planId: task.planId,
        subjectId: task.subjectId,
        topic: task.topic,
        type: task.type,
        title: task.title,
        scheduledDate: c.scheduledDate,
        estimatedMinutes: c.minutes,
        priority: task.priority,
        resourceUrl: task.resourceUrl,
      })),
    }),
  ]);

  revalidatePath("/planner");
}

export type AddCustomTaskInput = {
  planId: string;
  subjectId: string;
  type: "LEARN" | "REVISE" | "SOLVE_PYQS" | "PRACTICE" | "ATTEMPT_PAPER" | "MOCK_TEST";
  title: string;
  scheduledDate: string; // ISO date
  estimatedMinutes: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
};

const CUSTOM_PRIORITY_SCORE: Record<AddCustomTaskInput["priority"], number> = {
  HIGH: 80,
  MEDIUM: 50,
  LOW: 20,
};

export async function addCustomTaskAction(input: AddCustomTaskInput) {
  const student = await ensureStudentWritable();
  const plan = await prisma.studyPlan.findUnique({ where: { id: input.planId } });
  if (!plan || plan.studentId !== student.id) throw new Error("Plan not found.");

  const title = input.title.trim().slice(0, 140);
  if (!title) throw new Error("Task title can't be empty.");

  await prisma.plannerTask.create({
    data: {
      planId: input.planId,
      subjectId: input.subjectId,
      type: input.type,
      title,
      scheduledDate: new Date(input.scheduledDate),
      estimatedMinutes: Math.max(5, Math.min(240, input.estimatedMinutes)),
      priority: CUSTOM_PRIORITY_SCORE[input.priority],
      resourceUrl: `/subjects/${input.subjectId}`,
    },
  });

  revalidatePath("/planner");
}
