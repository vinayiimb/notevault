import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAnalytics, streakOf, type AnalyticsInput } from "@/lib/student-analytics";
import { istDay, istHour, hourLabel, clampPercent } from "@/lib/student-activity-format";

const now = new Date("2026-12-10T10:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const buy = (email: string, amount: number, items: string[], ago: number) => ({
  email, phone: "9199", amount, items, status: "APPROVED", createdAt: daysAgo(ago), reviewedAt: daysAgo(ago), utr: `pay_${email}_${ago}`,
});
const act = (email: string, ago: number, itemKey: string, seconds: number, maxScroll = 50, opens = 1) => ({
  email, day: istDay(daysAgo(ago)), itemKey, seconds, opens, maxScroll, lastAt: daysAgo(ago),
});

function base(): AnalyticsInput {
  return {
    now, rangeDays: 30,
    purchases: [
      buy("a@x.com", 199, ["p/s1", "p/s2", "p/s3", "p/s4", "p/s5", "p/s6"], 10),
      buy("b@x.com", 49, ["p/s1"], 5),
      buy("c@x.com", 119, ["p/s1", "p/s2", "p/s3"], 4), // never reads
      buy("a@x.com", 49, ["p/s7"], 2), // a is a repeat buyer
      buy("old@x.com", 99, ["p/s2"], 90), // outside the 30-day range
    ],
    activity: [act("a@x.com", 0, "p/s1", 1800, 80), act("a@x.com", 1, "p/s1", 600, 100), act("b@x.com", 20, "p/s1", 300, 40), act("a@x.com", 3, "p/s2", 900, 60)],
    hours: [{ email: "a@x.com", hour: 21, seconds: 3000 }, { email: "b@x.com", hour: 9, seconds: 300 }],
    devices: [
      { email: "a@x.com", label: "Chrome", createdAt: daysAgo(10), lastSeenAt: daysAgo(0), revokedAt: null },
      { email: "b@x.com", label: "Old", createdAt: daysAgo(9), lastSeenAt: daysAgo(8), revokedAt: daysAgo(7) },
      { email: "b@x.com", label: "Old2", createdAt: daysAgo(8), lastSeenAt: daysAgo(6), revokedAt: daysAgo(3) },
    ],
  };
}

test("revenue, orders, average order and previous-period comparison", () => {
  const a = computeAnalytics(base());
  assert.equal(a.revenue.total, 199 + 49 + 119 + 49);
  assert.equal(a.revenue.orders, 4);
  assert.equal(a.revenue.aov, Math.round(416 / 4));
  assert.equal(a.revenue.prevTotal, 0); // the only older order is 90 days old, outside the previous 30-day window
});

test("students: paying, new in range, repeat", () => {
  const a = computeAnalytics(base());
  assert.equal(a.students.paying, 4);
  assert.equal(a.students.newPaying, 3);
  assert.equal(a.students.repeat, 1);
});

test("engagement counts only the range, reading by hour is all-time", () => {
  const a = computeAnalytics(base());
  assert.equal(a.engagement.active, 2); // a and b (b read 20 days ago, inside 30)
  assert.equal(a.engagement.seconds, 1800 + 600 + 300 + 900);
  assert.equal(a.engagement.activePct, 50); // 2 of 4 paying
  assert.equal(a.hoursOfDay[21], 3000);
  assert.equal(a.engagement.dau.length, 30);
  assert.equal(a.engagement.dau.at(-1)!.value, 1);
});

test("top subjects rank by time; depth is the furthest each student got; unread are flagged", () => {
  const a = computeAnalytics(base());
  assert.equal(a.topSubjects[0].key, "p/s1");
  assert.equal(a.topSubjects[0].seconds, 2700);
  assert.equal(a.topSubjects[0].readers, 2);
  assert.equal(a.topSubjects[0].depth, Math.round((100 + 40) / 2));
  assert.ok(a.unreadSubjects.some((s) => s.key === "p/s7"));
  assert.ok(!a.unreadSubjects.some((s) => s.key === "p/s1"));
});

test("follow-up lists", () => {
  const a = computeAnalytics(base());
  assert.deepEqual(a.neverRead.map((p) => p.email), ["c@x.com", "old@x.com"]); // paid, no reading ever (newest first)
  assert.deepEqual(a.sharing.map((p) => p.email), ["b@x.com"]); // two swaps in 30 days
  const input = base();
  input.activity = [act("b@x.com", 20, "p/s1", 300)];
  assert.ok(computeAnalytics(input).quiet.some((p) => p.email === "b@x.com")); // read 20 days ago, silent since
});

test("expiring: only paid access ending within 30 days (6 months from purchase)", () => {
  const later = new Date("2027-05-01T10:00:00Z");
  const input: AnalyticsInput = { ...base(), now: later, purchases: [
    { ...buy("e@x.com", 49, ["p/s1"], 0), createdAt: new Date("2026-11-12T10:00:00Z"), reviewedAt: new Date("2026-11-12T10:00:00Z") }, // ends 2027-05-12
    { ...buy("f@x.com", 49, ["p/s1"], 0), createdAt: new Date("2027-04-01T10:00:00Z"), reviewedAt: new Date("2027-04-01T10:00:00Z") }, // ends in October
    buy("old@x.com", 99, ["p/s2"], 200), // pre-cutover = lifetime, never listed
  ] };
  const a = computeAnalytics(input);
  assert.deepEqual(a.expiring.map((p) => p.email), ["e@x.com"]);
  assert.match(a.expiring[0].detail, /ends in \d+ days/);
});

test("streakOf counts back from today or yesterday", () => {
  const d = (n: number) => istDay(daysAgo(n));
  assert.equal(streakOf([d(0), d(1), d(2), d(4)], now), 3);
  assert.equal(streakOf([d(1), d(2)], now), 2); // hasn't read yet today
  assert.equal(streakOf([d(3)], now), 0);
  assert.equal(streakOf([], now), 0);
});

test("format helpers", () => {
  assert.equal(istHour(new Date("2026-11-09T20:00:00Z")), 1); // 01:30 IST next day → hour 1
  assert.equal(hourLabel(0), "12 am");
  assert.equal(hourLabel(13), "1 pm");
  assert.equal(clampPercent(140), 100);
  assert.equal(clampPercent("x"), 0);
});
