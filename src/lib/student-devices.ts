import "server-only";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  STUDENT_COOKIE,
  STUDENT_COOKIE_OPTIONS,
  getStudentSession,
  isMissingTable,
  signStudentSession,
} from "@/lib/paid-notes";
import {
  DEVICE_IDLE_DAYS,
  MAX_DEVICES,
  MAX_SWAPS_PER_30_DAYS,
  decideDevice,
  deviceLabel,
} from "@/lib/student-device-policy";

// Applies the 2-device rule (student-device-policy.ts) to the database and
// the cookies. Every way of starting a student session — password, Google,
// the auto-login after a Razorpay payment — goes through startStudentSession.

// Long-lived, so signing out and back in on the same browser gets the same
// slot instead of looking like a new device.
const DEVICE_COOKIE = "notevault_sdev";
const DAY = 86_400_000;
// Readable by the header script only to switch "Login" to "My notes"; carries no access.
const SIGNED_IN_MARKER = "notevault_in";
const markSignedIn = (jar: Awaited<ReturnType<typeof cookies>>) =>
  jar.set(SIGNED_IN_MARKER, "1", { ...STUDENT_COOKIE_OPTIONS, httpOnly: false });

export type DeviceInfo = { id: string; label: string; lastSeen: string; since: string; current?: boolean };
export type StartResult = { ok: true } | { ok: false; error: string; devices?: DeviceInfo[] };

const liveWhere = (email: string) => ({ email, revokedAt: null, lastSeenAt: { gte: new Date(Date.now() - DEVICE_IDLE_DAYS * DAY) } });

const toInfo = (d: { id: string; label: string; lastSeenAt: Date; createdAt: Date }, currentId?: string | null): DeviceInfo => ({
  id: d.id,
  label: d.label,
  lastSeen: d.lastSeenAt.toISOString(),
  since: d.createdAt.toISOString(),
  current: d.id === currentId,
});

export async function listLiveDevices(email: string, currentId?: string | null): Promise<DeviceInfo[]> {
  const rows = await prisma.studentDevice.findMany({ where: liveWhere(email), orderBy: { lastSeenAt: "desc" } });
  return rows.map((d) => toInfo(d, currentId));
}

/** email -> number of devices signed in now, for everyone (admin list). Null = migration not applied yet. */
export async function liveDeviceCounts(): Promise<Map<string, number> | null> {
  try {
    const rows = await prisma.studentDevice.groupBy({
      by: ["email"],
      where: { revokedAt: null, lastSeenAt: { gte: new Date(Date.now() - DEVICE_IDLE_DAYS * DAY) } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.email, r._count._all]));
  } catch {
    return null;
  }
}

export async function startStudentSession(email: string, opts: { replaceDeviceId?: string } = {}): Promise<StartResult> {
  const jar = await cookies();
  try {
    const [live, swaps] = await Promise.all([
      prisma.studentDevice.findMany({ where: liveWhere(email), orderBy: { lastSeenAt: "desc" } }),
      prisma.studentDevice.count({ where: { email, revokedAt: { gte: new Date(Date.now() - 30 * DAY) } } }),
    ]);
    const decision = decideDevice({
      live,
      swapsLast30Days: swaps,
      cookieDeviceId: jar.get(DEVICE_COOKIE)?.value,
      replaceId: opts.replaceDeviceId,
    });

    if (decision.kind === "full") {
      return {
        ok: false,
        error: `You're already signed in on ${MAX_DEVICES} devices. Sign out of one to use this one.`,
        devices: live.map((d) => toInfo(d)),
      };
    }
    if (decision.kind === "swap-limit") {
      return {
        ok: false,
        error: `You've changed devices ${MAX_SWAPS_PER_30_DAYS} times this month. Message us on WhatsApp and we'll reset it.`,
      };
    }

    let deviceId: string;
    if (decision.kind === "reuse") {
      deviceId = decision.id;
      await prisma.studentDevice.update({ where: { id: deviceId }, data: { lastSeenAt: new Date() } });
    } else {
      const label = deviceLabel((await headers()).get("user-agent"));
      // ponytail: two logins at the exact same instant could both pass the count; the
      // next request from the extra one is still bounded by the swap cap. Add a
      // serializable transaction if abuse shows up.
      if (decision.revokeId) {
        await prisma.studentDevice.updateMany({ where: { id: decision.revokeId, email }, data: { revokedAt: new Date() } });
      }
      deviceId = (await prisma.studentDevice.create({ data: { email, label } })).id;
    }
    jar.set(DEVICE_COOKIE, deviceId, { ...STUDENT_COOKIE_OPTIONS, maxAge: 60 * 60 * 24 * 365 });
    jar.set(STUDENT_COOKIE, signStudentSession(email, deviceId), STUDENT_COOKIE_OPTIONS);
    markSignedIn(jar);
    return { ok: true };
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    // Migration not applied yet: sign in without the device limit rather than fail.
    jar.set(STUDENT_COOKIE, signStudentSession(email), STUDENT_COOKIE_OPTIONS);
    markSignedIn(jar);
    return { ok: true };
  }
}

/** Sign out of this browser: frees its slot (no swap counted) and clears the cookie. */
export async function endCurrentStudentSession() {
  const session = await getStudentSession();
  if (session?.deviceId) await prisma.studentDevice.deleteMany({ where: { id: session.deviceId, email: session.email } });
  const jar = await cookies();
  jar.delete(STUDENT_COOKIE);
  jar.delete(SIGNED_IN_MARKER);
}

/** Sign one of the student's own other devices out. Counts as a swap, and is capped like one. */
export async function revokeStudentDevice(email: string, deviceId: string): Promise<{ ok: boolean; error?: string }> {
  const swaps = await prisma.studentDevice.count({ where: { email, revokedAt: { gte: new Date(Date.now() - 30 * DAY) } } });
  if (swaps >= MAX_SWAPS_PER_30_DAYS) {
    return { ok: false, error: `You've changed devices ${MAX_SWAPS_PER_30_DAYS} times this month. Message us on WhatsApp and we'll reset it.` };
  }
  await prisma.studentDevice.updateMany({ where: { id: deviceId, email, revokedAt: null }, data: { revokedAt: new Date() } });
  return { ok: true };
}

/** Admin: forget every device for this email, including the swap history. */
export async function resetStudentDevices(email: string) {
  await prisma.studentDevice.deleteMany({ where: { email } });
}
