// Loose course/semester matching shared by the Bulk Upload spreadsheet
// importers (Fresh Upload rows, and the older Failed-Upload CSV deploy).
// Split out of actions.ts so it can be imported by src/lib/bulk-upload.ts
// without a circular "use server" <-> lib import.

export function normalizeLoose(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findProgramMatch<T extends { name: string }>(programs: T[], value: string): T | null {
  const v = normalizeLoose(value);
  if (!v) return null;

  // DU elective-pool shorthand: GSEC/SEC/VAC/VEC/AEC all live under the
  // "Common Pool" programme; a bare "GE" means the separate GE Pool.
  if (/^(gsec|sec|vac|vec|aec)$/.test(v) || v.includes("sec") || v.includes("vac") || v.includes("vec") || v.includes("aec")) {
    const pool = programs.find((p) => normalizeLoose(p.name).includes("commonpool"));
    if (pool) return pool;
  }
  if (v === "ge" || v.includes("genericelective")) {
    const pool = programs.find((p) => normalizeLoose(p.name).includes("gepool"));
    if (pool) return pool;
  }

  const exact = programs.find((p) => normalizeLoose(p.name) === v);
  if (exact) return exact;
  return programs.find((p) => normalizeLoose(p.name).includes(v) || v.includes(normalizeLoose(p.name))) ?? null;
}

export function findTermMatch<T extends { name: string }>(terms: T[], value: string): T | null {
  const v = normalizeLoose(value);
  if (!v) return null;

  if (v === "all" || v.includes("allsemester")) {
    return terms.find((t) => normalizeLoose(t.name).includes("allsemester")) ?? null;
  }
  const num = v.match(/\d+/)?.[0];
  if (num) {
    const found = terms.find((t) => normalizeLoose(t.name) === `semester${num}`);
    if (found) return found;
  }
  const exact = terms.find((t) => normalizeLoose(t.name) === v);
  if (exact) return exact;
  return terms.find((t) => normalizeLoose(t.name).includes(v) || v.includes(normalizeLoose(t.name))) ?? null;
}
