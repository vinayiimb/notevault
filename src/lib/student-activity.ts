import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { istDay, istHour } from "@/lib/student-activity-format";
import { computeAnalytics, streakOf, type Analytics } from "@/lib/student-analytics";

// Reading time per student. Written by /api/student-activity, read by the admin
// Students pages. Every read returns null when the table doesn't exist yet (the
// migration isn't applied), so a deploy can never break those pages.

const isMissing = (err: unknown) => ["P2021", "P2022"].includes((err as { code?: string } | null)?.code ?? "");

export async function recordActivity(email: string, itemKey: string, seconds: number, opened: boolean, scroll: number) {
  const now = new Date();
  const opens = opened ? 1 : 0;
  // Raw upserts: Prisma can't do GREATEST() for the scroll depth atomically.
  const writes = [
    prisma.$executeRaw`INSERT INTO "StudentActivity" ("id","email","day","itemKey","seconds","opens","maxScroll","firstAt","lastAt")
      VALUES (${randomUUID()}, ${email}, ${istDay(now)}, ${itemKey}, ${seconds}, ${opens}, ${scroll}, ${now}, ${now})
      ON CONFLICT ("email","day","itemKey") DO UPDATE SET
        "seconds" = "StudentActivity"."seconds" + EXCLUDED."seconds",
        "opens" = "StudentActivity"."opens" + EXCLUDED."opens",
        "maxScroll" = GREATEST("StudentActivity"."maxScroll", EXCLUDED."maxScroll"),
        "lastAt" = EXCLUDED."lastAt"`,
  ];
  if (seconds > 0) {
    writes.push(
      prisma.$executeRaw`INSERT INTO "StudentHour" ("email","hour","seconds") VALUES (${email}, ${istHour(now)}, ${seconds})
        ON CONFLICT ("email","hour") DO UPDATE SET "seconds" = "StudentHour"."seconds" + EXCLUDED."seconds"`,
    );
  }
  await prisma.$transaction(writes);
}

export type ActivitySummary = { seconds: number; lastAt: Date };

/** email -> total reading time + last active, for everyone. */
export async function getActivitySummaries(): Promise<Map<string, ActivitySummary> | null> {
  try {
    const rows = await prisma.studentActivity.groupBy({ by: ["email"], _sum: { seconds: true }, _max: { lastAt: true } });
    return new Map(rows.map((r) => [r.email, { seconds: r._sum.seconds ?? 0, lastAt: r._max.lastAt ?? new Date(0) }]));
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
}

export type StudentActivityDetail = {
  totalSeconds: number;
  activeDays: number;
  lastAt: Date | null;
  /** Newest first, last `windowDays` days (default 14) incl. empty ones. */
  days: { day: string; seconds: number }[];
  subjects: { key: string; seconds: number; opens: number; days: number; lastAt: Date; depth: number }[];
  streak: number;
  /** Average reading minutes on the days they read. */
  avgPerActiveDay: number;
  /** Their busiest hour of the day (0-23, India time), null before any reading. */
  peakHour: number | null;
  hours: number[];
};

export async function getStudentActivity(email: string, windowDays = 14): Promise<StudentActivityDetail | null> {
  try {
    const [rows, hourRows] = await Promise.all([
      prisma.studentActivity.findMany({ where: { email }, orderBy: { day: "desc" }, take: 2000 }),
      prisma.studentHour.findMany({ where: { email } }),
    ]);
    const perDay = new Map<string, number>();
    const perKey = new Map<string, { key: string; seconds: number; opens: number; days: Set<string>; lastAt: Date; depth: number }>();
    for (const r of rows) {
      perDay.set(r.day, (perDay.get(r.day) ?? 0) + r.seconds);
      const k = perKey.get(r.itemKey) ?? { key: r.itemKey, seconds: 0, opens: 0, days: new Set<string>(), lastAt: r.lastAt, depth: 0 };
      k.depth = Math.max(k.depth, r.maxScroll);
      k.seconds += r.seconds;
      k.opens += r.opens;
      k.days.add(r.day);
      if (r.lastAt > k.lastAt) k.lastAt = r.lastAt;
      perKey.set(r.itemKey, k);
    }
    const days = Array.from({ length: windowDays }, (_, i) => {
      const day = istDay(new Date(Date.now() - i * 86_400_000));
      return { day, seconds: perDay.get(day) ?? 0 };
    });
    const hours = Array.from({ length: 24 }, () => 0);
    for (const h of hourRows) if (h.hour >= 0 && h.hour < 24) hours[h.hour] += h.seconds;
    const activeDayList = [...perDay].filter(([, sec]) => sec > 0).map(([d]) => d);
    const totalSeconds = rows.reduce((n, r) => n + r.seconds, 0);
    return {
      streak: streakOf(activeDayList, new Date()),
      avgPerActiveDay: activeDayList.length ? Math.round(totalSeconds / activeDayList.length / 60) : 0,
      peakHour: hours.some((v) => v > 0) ? hours.indexOf(Math.max(...hours)) : null,
      hours,
      totalSeconds,
      activeDays: activeDayList.length,
      lastAt: rows.reduce<Date | null>((m, r) => (!m || r.lastAt > m ? r.lastAt : m), null),
      days,
      subjects: [...perKey.values()].map((k) => ({ ...k, days: k.days.size })).sort((a, b) => b.seconds - a.seconds),
    };
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
}

/** Everything the Analytics page shows, for the last `rangeDays` days. Null = migration not applied yet. */
export async function getAnalytics(rangeDays: number): Promise<Analytics | null> {
  try {
    // ponytail: loads all rows and aggregates in memory; fine to a few thousand students, move to SQL after that.
    const since = istDay(new Date(Date.now() - 2 * 90 * 86_400_000));
    const [purchases, activity, hours, devices] = await Promise.all([
      prisma.purchase.findMany({ select: { email: true, phone: true, amount: true, items: true, status: true, createdAt: true, reviewedAt: true, utr: true } }),
      prisma.studentActivity.findMany({ where: { day: { gte: since } }, select: { email: true, day: true, itemKey: true, seconds: true, opens: true, maxScroll: true, lastAt: true } }),
      prisma.studentHour.findMany(),
      prisma.studentDevice.findMany({ select: { email: true, label: true, createdAt: true, lastSeenAt: true, revokedAt: true } }).catch(() => []),
    ]);
    return computeAnalytics({ purchases, activity, hours, devices, now: new Date(), rangeDays });
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
}
