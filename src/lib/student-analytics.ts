// Pure maths for the admin Analytics page and the student detail — takes plain
// rows (loaded by student-activity.ts), returns plain numbers, so it is unit-testable.
import { accessExpiry } from "@/lib/paid-notes-pricing";
import { istDay } from "@/lib/student-activity-format";
import { MAX_DEVICES } from "@/lib/student-device-policy";

export type PurchaseRow = { email: string; phone: string; amount: number; items: string[]; status: string; createdAt: Date; reviewedAt: Date | null; utr: string };
export type ActivityRow = { email: string; day: string; itemKey: string; seconds: number; opens: number; maxScroll: number; lastAt: Date };
export type HourRow = { email: string; hour: number; seconds: number };
export type DeviceRow = { email: string; label: string; createdAt: Date; lastSeenAt: Date; revokedAt: Date | null };

export type AnalyticsInput = { purchases: PurchaseRow[]; activity: ActivityRow[]; hours: HourRow[]; devices: DeviceRow[]; now: Date; rangeDays: number };

export type Person = { email: string; phone: string; detail: string };

export type Analytics = {
  rangeDays: number;
  revenue: { total: number; prevTotal: number; orders: number; aov: number; byDay: { day: string; value: number }[] };
  planMix: { label: string; count: number; amount: number }[];
  students: { paying: number; newPaying: number; repeat: number };
  engagement: { active: number; activePct: number; seconds: number; avgPerActive: number; dau: { day: string; value: number }[]; avgDau: number; readByDay: { day: string; value: number }[] };
  hoursOfDay: number[];
  topSubjects: { key: string; readers: number; seconds: number; opens: number; depth: number; buyers: number }[];
  unreadSubjects: { key: string; buyers: number }[];
  neverRead: Person[];
  quiet: Person[];
  expiring: Person[];
  sharing: Person[];
};

const DAY = 86_400_000;
const isPaid = (p: PurchaseRow) => p.status === "APPROVED" && p.amount > 0;
const lastDays = (n: number, now: Date) => Array.from({ length: n }, (_, i) => istDay(new Date(now.getTime() - (n - 1 - i) * DAY)));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function planLabel(count: number) {
  return count === 1 ? "1 subject" : count === 2 ? "2 subjects" : count === 3 ? "3 subjects" : count < 6 ? `${count} subjects` : count === 6 ? "Whole semester (6)" : `${count} subjects`;
}

export function computeAnalytics({ purchases, activity, hours, devices, now, rangeDays }: AnalyticsInput): Analytics {
  const from = new Date(now.getTime() - rangeDays * DAY);
  const prevFrom = new Date(now.getTime() - 2 * rangeDays * DAY);
  const paid = purchases.filter(isPaid);
  const paidIn = paid.filter((p) => p.createdAt >= from);
  const chartDays = lastDays(Math.min(rangeDays, 30), now);

  // ---- revenue
  const revByDay = new Map<string, number>();
  for (const p of paidIn) revByDay.set(istDay(p.createdAt), (revByDay.get(istDay(p.createdAt)) ?? 0) + p.amount);
  const total = sum(paidIn.map((p) => p.amount));
  const mix = new Map<string, { label: string; count: number; amount: number }>();
  for (const p of paidIn) {
    const label = planLabel(p.items.length || 1);
    const m = mix.get(label) ?? { label, count: 0, amount: 0 };
    m.count++;
    m.amount += p.amount;
    mix.set(label, m);
  }

  // ---- students
  const firstPaid = new Map<string, Date>();
  const paidCount = new Map<string, number>();
  for (const p of paid) {
    const f = firstPaid.get(p.email);
    if (!f || p.createdAt < f) firstPaid.set(p.email, p.createdAt);
    paidCount.set(p.email, (paidCount.get(p.email) ?? 0) + 1);
  }

  // ---- engagement
  const actIn = activity.filter((a) => a.day >= istDay(from));
  const activeEmails = new Set(actIn.filter((a) => a.seconds > 0 || a.opens > 0).map((a) => a.email));
  const activePaying = [...activeEmails].filter((e) => firstPaid.has(e)).length;
  const seconds = sum(actIn.map((a) => a.seconds));
  const dauMap = new Map<string, Set<string>>();
  for (const a of activity) (dauMap.get(a.day) ?? dauMap.set(a.day, new Set()).get(a.day)!).add(a.email);
  const dau = chartDays.map((day) => ({ day, value: dauMap.get(day)?.size ?? 0 }));
  const secByDay = new Map<string, number>();
  for (const a of activity) secByDay.set(a.day, (secByDay.get(a.day) ?? 0) + a.seconds);
  const readByDay = chartDays.map((day) => ({ day, value: Math.round((secByDay.get(day) ?? 0) / 60) })); // minutes
  const hoursOfDay = Array.from({ length: 24 }, () => 0);
  for (const h of hours) if (h.hour >= 0 && h.hour < 24) hoursOfDay[h.hour] += h.seconds;

  // ---- subjects (depth = per student the furthest they got, averaged)
  type Sub = { key: string; readers: Set<string>; seconds: number; opens: number; depthByEmail: Map<string, number>; buyers: Set<string> };
  const subs = new Map<string, Sub>();
  const sub = (key: string): Sub => subs.get(key) ?? subs.set(key, { key, readers: new Set(), seconds: 0, opens: 0, depthByEmail: new Map(), buyers: new Set() }).get(key)!;
  for (const p of paid) for (const k of p.items) sub(k).buyers.add(p.email);
  for (const a of activity) {
    const s = sub(a.itemKey);
    s.readers.add(a.email);
    s.depthByEmail.set(a.email, Math.max(s.depthByEmail.get(a.email) ?? 0, a.maxScroll));
  }
  for (const a of actIn) {
    const s = sub(a.itemKey);
    s.seconds += a.seconds;
    s.opens += a.opens;
  }
  const topSubjects = [...subs.values()]
    .filter((s) => s.seconds > 0)
    .map((s) => ({ key: s.key, readers: s.readers.size, seconds: s.seconds, opens: s.opens, buyers: s.buyers.size, depth: s.depthByEmail.size ? Math.round(sum([...s.depthByEmail.values()]) / s.depthByEmail.size) : 0 }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 8);
  const unreadSubjects = [...subs.values()]
    .filter((s) => s.buyers.size > 0 && s.readers.size === 0)
    .map((s) => ({ key: s.key, buyers: s.buyers.size }))
    .sort((a, b) => b.buyers - a.buyers)
    .slice(0, 8);

  // ---- who to follow up (per email)
  const lastActive = new Map<string, Date>();
  for (const a of activity) if (!lastActive.get(a.email) || a.lastAt > lastActive.get(a.email)!) lastActive.set(a.email, a.lastAt);
  const phoneOf = (e: string) => purchases.find((p) => p.email === e && p.phone)?.phone ?? "";
  const person = (email: string, detail: string): Person => ({ email, phone: phoneOf(email), detail });
  const ago = (d: Date) => Math.max(0, Math.floor((now.getTime() - d.getTime()) / DAY));

  // access end per email = latest end across its paid, approved purchases (null = lifetime)
  const endOf = new Map<string, Date | null>();
  for (const p of purchases.filter((x) => x.status === "APPROVED")) {
    const end = accessExpiry(p);
    const prev = endOf.get(p.email);
    if (prev === null) continue;
    endOf.set(p.email, end === null || prev === undefined || end > prev ? end : prev);
  }

  const neverRead: Person[] = [];
  const quiet: Person[] = [];
  const expiring: Person[] = [];
  for (const [email, first] of [...firstPaid].sort((a, b) => b[1].getTime() - a[1].getTime())) {
    const end = endOf.get(email);
    const live = end === null || (end !== undefined && end > now);
    const last = lastActive.get(email);
    if (!last && live && now.getTime() - first.getTime() > 2 * DAY) neverRead.push(person(email, `Paid ${ago(first)} day${ago(first) === 1 ? "" : "s"} ago, never opened a note`));
    else if (last && live && now.getTime() - last.getTime() > 7 * DAY) quiet.push(person(email, `Last read ${ago(last)} days ago`));
    if (end && end > now && end.getTime() - now.getTime() <= 30 * DAY) expiring.push(person(email, `Access ends in ${Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY))} days`));
  }
  expiring.sort((a, b) => Number(a.detail.match(/\d+/)?.[0]) - Number(b.detail.match(/\d+/)?.[0]));

  const swaps = new Map<string, number>();
  const live = new Map<string, number>();
  for (const d of devices) {
    if (d.revokedAt && now.getTime() - d.revokedAt.getTime() <= 30 * DAY) swaps.set(d.email, (swaps.get(d.email) ?? 0) + 1);
    if (!d.revokedAt) live.set(d.email, (live.get(d.email) ?? 0) + 1);
  }
  const sharing = [...swaps]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([email, n]) => person(email, `${n} device swaps in 30 days · ${live.get(email) ?? 0}/${MAX_DEVICES} signed in now`));

  return {
    rangeDays,
    revenue: {
      total,
      prevTotal: sum(paid.filter((p) => p.createdAt >= prevFrom && p.createdAt < from).map((p) => p.amount)),
      orders: paidIn.length,
      aov: paidIn.length ? Math.round(total / paidIn.length) : 0,
      byDay: chartDays.map((day) => ({ day, value: revByDay.get(day) ?? 0 })),
    },
    planMix: [...mix.values()].sort((a, b) => b.count - a.count),
    students: {
      paying: firstPaid.size,
      newPaying: [...firstPaid.values()].filter((d) => d >= from).length,
      repeat: [...paidCount.values()].filter((n) => n >= 2).length,
    },
    engagement: {
      active: activeEmails.size,
      activePct: firstPaid.size ? Math.round((activePaying / firstPaid.size) * 100) : 0,
      seconds,
      avgPerActive: activeEmails.size ? Math.round(seconds / activeEmails.size) : 0,
      dau,
      readByDay,
      avgDau: dau.length ? Math.round((sum(dau.map((d) => d.value)) / dau.length) * 10) / 10 : 0,
    },
    hoursOfDay,
    topSubjects,
    unreadSubjects,
    neverRead,
    quiet,
    expiring,
    sharing,
  };
}

/** Consecutive active days ending today (or yesterday, so an evening reader isn't "broken" at breakfast). */
export function streakOf(days: string[], now: Date): number {
  const set = new Set(days);
  let cursor = set.has(istDay(now)) ? now : new Date(now.getTime() - DAY);
  let n = 0;
  while (set.has(istDay(cursor))) {
    n++;
    cursor = new Date(cursor.getTime() - DAY);
  }
  return n;
}
