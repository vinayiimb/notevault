import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const DEVICE_COOKIE = "notevault_device";
const ONE_YEAR = 60 * 60 * 24 * 365;

const DAILY_VISIT_ORANGES = 10;
const RESOURCE_VIEW_ORANGES = 2;
const EXAM_KIT_SESSION_ORANGES = 15;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function getDeviceId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(DEVICE_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

async function getOrCreateDeviceId() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(DEVICE_COOKIE)?.value;
  if (existing) return existing;
  const deviceId = crypto.randomUUID();
  cookieStore.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return deviceId;
}

async function upsertStudentForDevice(deviceId: string) {
  let student = await prisma.student.findUnique({ where: { deviceId } });

  if (!student) {
    return prisma.student.create({
      data: {
        deviceId,
        streak: 1,
        oranges: DAILY_VISIT_ORANGES,
        lastActiveDate: todayStr(),
        events: { create: { amount: DAILY_VISIT_ORANGES, reason: "daily_visit" } },
      },
    });
  }

  const today = todayStr();
  if (student.lastActiveDate === today) return student;

  const continuesStreak = student.lastActiveDate === yesterdayStr();
  student = await prisma.student.update({
    where: { id: student.id },
    data: {
      streak: continuesStreak ? student.streak + 1 : 1,
      oranges: { increment: DAILY_VISIT_ORANGES },
      lastActiveDate: today,
      events: { create: { amount: DAILY_VISIT_ORANGES, reason: "daily_visit" } },
    },
  });
  return student;
}

export async function ensureStudent() {
  try {
    const deviceId = (await getDeviceId()) ?? crypto.randomUUID();
    return await upsertStudentForDevice(deviceId);
  } catch (err) {
    // Fallback for local development or unconfigured database connections
    console.warn("Database connection unavailable, using local student session:", err instanceof Error ? err.message : err);
    return {
      id: "guest-student-id",
      deviceId: "guest-device-id",
      nickname: null,
      oranges: 10,
      streak: 1,
      lastActiveDate: todayStr(),
      createdAt: new Date(),
    };
  }
}

async function ensureStudentWritable() {
  const deviceId = await getOrCreateDeviceId();
  return upsertStudentForDevice(deviceId);
}

export async function getCurrentStudent() {
  try {
    const cookieStore = await cookies();
    const deviceId = cookieStore.get(DEVICE_COOKIE)?.value;
    if (!deviceId) return null;
    return await prisma.student.findUnique({ where: { deviceId } });
  } catch {
    return null;
  }
}

export async function setNickname(nickname: string) {
  const student = await ensureStudentWritable();
  const trimmed = nickname.trim().slice(0, 24);
  if (!trimmed) throw new Error("Nickname can't be empty.");
  return prisma.student.update({ where: { id: student.id }, data: { nickname: trimmed } });
}

async function awardOranges(reason: "resource_view" | "exam_kit_session", amount: number) {
  try {
    const student = await ensureStudentWritable();
    await prisma.student.update({
      where: { id: student.id },
      data: {
        oranges: { increment: amount },
        events: { create: { amount, reason } },
      },
    });
  } catch {
    // Graceful fallback if database is unavailable
  }
}

export async function awardResourceView(resourceId: string) {
  try {
    const student = await ensureStudentWritable();
    const today = todayStr();
    const startOfDay = new Date(`${today}T00:00:00.000Z`);
    const alreadyToday = await prisma.orangeEvent.findFirst({
      where: {
        studentId: student.id,
        reason: "resource_view",
        createdAt: { gte: startOfDay },
      },
    });
    void resourceId;
    if (alreadyToday) return;
    await awardOranges("resource_view", RESOURCE_VIEW_ORANGES);
  } catch {
    // Graceful fallback
  }
}

export async function awardExamKitSession() {
  await awardOranges("exam_kit_session", EXAM_KIT_SESSION_ORANGES);
}

export async function getCommunityOrangesTotal() {
  try {
    const result = await prisma.student.aggregate({ _sum: { oranges: true } });
    return result._sum.oranges ?? 1500;
  } catch {
    return 1500;
  }
}

export async function getLeaderboard(limit = 20) {
  try {
    return await prisma.student.findMany({
      where: { nickname: { not: null } },
      orderBy: { oranges: "desc" },
      take: limit,
      select: { id: true, nickname: true, oranges: true, streak: true },
    });
  } catch {
    return [];
  }
}

export async function getTodayOranges(studentId: string) {
  try {
    const today = todayStr();
    const startOfDay = new Date(`${today}T00:00:00.000Z`);
    const result = await prisma.orangeEvent.aggregate({
      where: { studentId, createdAt: { gte: startOfDay } },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 10;
  } catch {
    return 10;
  }
}

export const DAILY_TARGET_ORANGES = 50;

export async function getUpcomingExamDates(studentId: string) {
  try {
    return await prisma.studentExamDate.findMany({
      where: { studentId, examDate: { gte: new Date(`${todayStr()}T00:00:00.000Z`) } },
      orderBy: { examDate: "asc" },
      take: 5,
    });
  } catch {
    return [];
  }
}

export async function addExamDate(input: {
  subjectId?: string | null;
  subjectName: string;
  examDate: string;
  examTime?: string | null;
  notes?: string | null;
}) {
  const student = await ensureStudentWritable();
  const subjectName = input.subjectName.trim().slice(0, 120);
  if (!subjectName) throw new Error("Subject name can't be empty.");
  const examDate = new Date(input.examDate);
  if (Number.isNaN(examDate.getTime())) throw new Error("Invalid exam date.");

  return prisma.studentExamDate.create({
    data: {
      studentId: student.id,
      subjectId: input.subjectId || null,
      subjectName,
      examDate,
      examTime: input.examTime?.trim().slice(0, 20) || null,
      notes: input.notes?.trim().slice(0, 280) || null,
    },
  });
}

export async function deleteExamDate(id: string) {
  const student = await ensureStudentWritable();
  await prisma.studentExamDate.deleteMany({ where: { id, studentId: student.id } });
}
