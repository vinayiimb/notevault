// How active a student is, from when they last read. Pure, so it is unit-tested.
export const STUDENT_STATUSES = [
  { id: "today", label: "Active today", dot: "bg-green-500", text: "text-green-700 dark:text-green-400", bg: "bg-green-600/10" },
  { id: "week", label: "This week", dot: "bg-emerald-400", text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  { id: "slipping", label: "Slipping", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/10" },
  { id: "inactive", label: "Inactive 30d+", dot: "bg-red-500", text: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
  { id: "never", label: "Never read", dot: "bg-zinc-400", text: "text-muted", bg: "bg-surface-muted" },
] as const;
export type StudentStatusId = (typeof STUDENT_STATUSES)[number]["id"];

const DAY = 86_400_000;
/** today: < 24 h · week: < 7 d · slipping: 7-30 d · inactive: > 30 d · never: no reading recorded. */
export function studentStatus(lastActive: Date | null, now: number = Date.now()): StudentStatusId {
  if (!lastActive) return "never";
  const age = now - lastActive.getTime();
  return age < DAY ? "today" : age < 7 * DAY ? "week" : age < 30 * DAY ? "slipping" : "inactive";
}
export const statusInfo = (id: StudentStatusId) => STUDENT_STATUSES.find((s) => s.id === id)!;
