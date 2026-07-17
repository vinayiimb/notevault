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

// Read-only: the device cookie is assigned by proxy.ts middleware before any
// page render reaches here, so this never needs to write a cookie itself
// (cookie writes are illegal from a Server Component render).
async function getDeviceId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(DEVICE_COOKIE)?.value ?? null;
}

// Read+write: only safe to call from Server Actions / Route Handlers, which
// (unlike Server Components) are allowed to write cookies.
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

// Ensures a Student row exists for this device and applies the daily-visit
// streak/orange bump at most once per calendar day.
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

// Safe to call from Server Components: never writes a cookie. Assumes
// proxy.ts has already assigned the device cookie (true for every matched
// route). Falls back to a fresh, unpersisted device id in the (practically
// unreachable) case it hasn't — that render just won't be able to persist
// gamification state until the cookie exists on a later request.
export async function ensureStudent() {
  const deviceId = (await getDeviceId()) ?? crypto.randomUUID();
  return upsertStudentForDevice(deviceId);
}

// Safe to call from Server Actions / Route Handlers: creates the device
// cookie if somehow still missing.
async function ensureStudentWritable() {
  const deviceId = await getOrCreateDeviceId();
  return upsertStudentForDevice(deviceId);
}

export async function getCurrentStudent() {
  const cookieStore = await cookies();
  const deviceId = cookieStore.get(DEVICE_COOKIE)?.value;
  if (!deviceId) return null;
  return prisma.student.findUnique({ where: { deviceId } });
}

export async function setNickname(nickname: string) {
  const student = await ensureStudentWritable();
  const trimmed = nickname.trim().slice(0, 24);
  if (!trimmed) throw new Error("Nickname can't be empty.");
  return prisma.student.update({ where: { id: student.id }, data: { nickname: trimmed } });
}

async function awardOranges(reason: "resource_view" | "exam_kit_session", amount: number) {
  const student = await ensureStudentWritable();
  await prisma.student.update({
    where: { id: student.id },
    data: {
      oranges: { increment: amount },
      events: { create: { amount, reason } },
    },
  });
}

// Awards oranges for viewing/downloading a resource, once per resource per
// calendar day per device (repeat views of the same paper don't farm oranges).
export async function awardResourceView(resourceId: string) {
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
  // resourceId isn't stored on OrangeEvent (kept generic) — cap resource-view
  // oranges at once per day overall rather than per-resource, to keep the
  // reward model simple and resistant to refresh-spam.
  void resourceId;
  if (alreadyToday) return;
  await awardOranges("resource_view", RESOURCE_VIEW_ORANGES);
}

export async function awardExamKitSession() {
  await awardOranges("exam_kit_session", EXAM_KIT_SESSION_ORANGES);
}

export async function getCommunityOrangesTotal() {
  const result = await prisma.student.aggregate({ _sum: { oranges: true } });
  return result._sum.oranges ?? 0;
}

export async function getLeaderboard(limit = 20) {
  return prisma.student.findMany({
    where: { nickname: { not: null } },
    orderBy: { oranges: "desc" },
    take: limit,
    select: { id: true, nickname: true, oranges: true, streak: true },
  });
}

export async function getTodayOranges(studentId: string) {
  const today = todayStr();
  const startOfDay = new Date(`${today}T00:00:00.000Z`);
  const result = await prisma.orangeEvent.aggregate({
    where: { studentId, createdAt: { gte: startOfDay } },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export const DAILY_TARGET_ORANGES = 50;
