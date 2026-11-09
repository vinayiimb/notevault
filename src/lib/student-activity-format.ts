// Client-safe helpers for the reading-time tracker (no Prisma).

/** One heartbeat can carry at most this many seconds (client flushes every ~60 s). */
export const MAX_BEAT_SECONDS = 120;

export const clampSeconds = (raw: unknown): number => {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_BEAT_SECONDS) : 0;
};

/** Accepts "programmeSlug/subjectSlug" only. */
export const isItemKey = (k: unknown): k is string => typeof k === "string" && k.length <= 200 && /^[\w.-]+\/[\w.-]+$/.test(k);

/** "2026-11-09" in India time — the day a reading session is counted on. */
export const istDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** 3725 -> "1h 2m", 95 -> "1m", 20 -> "<1m", 0 -> "0m". */
export function fmtDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  if (seconds < 60) return "<1m";
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Furthest-scroll percentage, kept to 0-100. */
export const clampPercent = (raw: unknown): number => {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 100) : 0;
};

/** Hour of the day (0-23) in India time. */
export const istHour = (d = new Date()): number =>
  Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(d)) % 24;

/** 0 -> "12 am", 13 -> "1 pm". */
export const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;
