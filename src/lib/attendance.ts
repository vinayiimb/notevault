/** Attendance maths. `target` is a fraction (0.75 = 75%). */
export function attendancePlan(attended: number, held: number, target: number) {
  const a = Math.max(0, Math.floor(attended));
  const h = Math.max(a, Math.floor(held));
  const t = Math.min(0.99, Math.max(0.01, target));
  const pct = h > 0 ? (a / h) * 100 : 0;
  if (h === 0) return { pct, status: "empty" as const, count: 0 };
  // Epsilon guards float error, e.g. 3/4 vs 0.75.
  if (a / h >= t - 1e-9) return { pct, status: "safe" as const, count: Math.max(0, Math.floor(a / t + 1e-9) - h) };
  return { pct, status: "short" as const, count: Math.ceil((t * h - a) / (1 - t) - 1e-9) };
}
