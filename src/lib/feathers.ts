// Feathers 🪶: the dashboard's collectible. Not stored anywhere: it is derived
// from reading time the note reader already records, so it can't drift or be
// farmed through an endpoint. 1 feather per minute read + 10 per day you read.
// Client-safe (no Prisma).

export const FEATHERS_PER_ACTIVE_DAY = 10;
export const GOAL_CHOICES = [15, 30, 45, 60, 90] as const;
export const DEFAULT_GOAL_MIN = 30;

export function feathersFor(totalSeconds: number, activeDays: number): number {
  return Math.floor(Math.max(0, totalSeconds) / 60) + Math.max(0, activeDays) * FEATHERS_PER_ACTIVE_DAY;
}

export const RANKS = [
  { name: "Hatchling", emoji: "🥚", from: 0 },
  { name: "Fledgling", emoji: "🐣", from: 50 },
  { name: "Parrot", emoji: "🦜", from: 200 },
  { name: "Scholar", emoji: "🎓", from: 600 },
  { name: "Topper", emoji: "👑", from: 1500 },
] as const;

/** Current rank, the next one (null at the top) and 0-100 progress towards it. */
export function rankFor(feathers: number) {
  let i = 0;
  while (i + 1 < RANKS.length && feathers >= RANKS[i + 1].from) i++;
  const rank = RANKS[i];
  const next = RANKS[i + 1] ?? null;
  const pct = next ? Math.round(((feathers - rank.from) / (next.from - rank.from)) * 100) : 100;
  return { rank, next, pct, toNext: next ? next.from - feathers : 0 };
}

/** Goal progress for today, capped at 100. */
export function goalPct(todaySeconds: number, goalMin: number): number {
  return goalMin > 0 ? Math.min(100, Math.floor((todaySeconds / 60 / goalMin) * 100)) : 0;
}

export function parseGoal(raw: string | undefined | null): number {
  const n = Number(raw);
  return (GOAL_CHOICES as readonly number[]).includes(n) ? n : DEFAULT_GOAL_MIN;
}

export const SUBJECT_TYPES = ["DSC", "DSE", "GE", "SEC", "AEC", "VAC"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];
export const DEFAULT_MAX_SUBJECTS = 12;
/** Ceiling an admin can set for one student. */
export const MAX_SUBJECT_LIMIT = 60;

/** Admin's number from a form: clamped to 1..MAX_SUBJECT_LIMIT, or null (blank / not a number) = use the default. */
export function parseSubjectLimit(raw: unknown): number | null {
  const n = Math.floor(Number(String(raw ?? "").trim()));
  return String(raw ?? "").trim() === "" || !Number.isFinite(n) ? null : Math.min(MAX_SUBJECT_LIMIT, Math.max(1, n));
}

export type SubjectInput = { type: SubjectType; name: string; code: string | null; course: string | null; semester: number | null };

export const SUBJECT_TYPE_INFO: Record<SubjectType, { label: string; short: string }> = {
  DSC: { label: "Discipline Specific Core", short: "Core" },
  DSE: { label: "Discipline Specific Elective", short: "Elective" },
  GE: { label: "Generic Elective", short: "Generic" },
  SEC: { label: "Skill Enhancement Course", short: "Skill" },
  AEC: { label: "Ability Enhancement Course", short: "Ability" },
  VAC: { label: "Value Added Course", short: "Value" },
};

/** Trim and validate an "add subject" submission. */
export function cleanSubject(raw: { type?: unknown; name?: unknown; code?: unknown; course?: unknown; semester?: unknown }): { ok: true; value: SubjectInput } | { ok: false; error: string } {
  const type = String(raw.type ?? "").toUpperCase();
  const name = String(raw.name ?? "").replace(/\s+/g, " ").trim();
  const code = String(raw.code ?? "").trim().toUpperCase();
  if (!(SUBJECT_TYPES as readonly string[]).includes(type)) return { ok: false, error: "Pick a type (SEC, VAC, GE, AEC, DSC or DSE)." };
  if (name.length < 2 || name.length > 120) return { ok: false, error: "Enter the subject name." };
  if (code && !/^[A-Z0-9 /-]{3,20}$/.test(code)) return { ok: false, error: "Subject code can only have letters, numbers, - and /." };
  const course = String(raw.course ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
  const sem = Number(raw.semester);
  return { ok: true, value: { type: type as SubjectType, name, code: code || null, course: course || null, semester: Number.isInteger(sem) && sem >= 1 && sem <= 8 ? sem : null } };
}
