// Pure helper (no server imports) so it can be unit tested.
const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
const num = (t: string) => ROMAN[t] ?? (/^[1-8]$/.test(t) ? Number(t) : 0);

/** "I", "Semester- IV", "III/IV", "I-VI", "IIi" -> the semester numbers it covers. "Pool / not fixed" -> none. */
export function semestersOf(raw: string): number[] {
  const out = new Set<number>();
  for (const token of raw.toUpperCase().replace(/SEMESTER/g, "").replace(/\s+/g, "").split(/[/,]/)) {
    const range = token.split("-").filter(Boolean);
    if (range.length === 2 && num(range[0]) && num(range[1])) {
      for (let n = num(range[0]); n <= num(range[1]); n++) out.add(n);
    } else if (range.length === 1 && num(range[0])) out.add(num(range[0]));
  }
  return [...out];
}
