// Forgiving search for /papers: students type "polscience", "ba hons pol sci",
// "bcom h", "bsc cs", "bba fia" — all of which should find the course however
// DU happened to print its name ("B.A. (Hons.)", "B. Com (H)", "Bachelor of
// Arts (Hons)", "History Honours", …).

// Degrees are printed every way ("B.A.", "B. A", "BA", "Bachelor of Arts") — fold to one word.
const PHRASES: [RegExp, string][] = [
  [/\bbachelor\W+of\W+arts\b/g, "ba"],
  [/\bbachelor\W+of\W+science\b/g, "bsc"],
  [/\bbachelor\W+of\W+commerce\b/g, "bcom"],
  [/\bbachelor\W+of\W+business\W+administration\b/g, "bba"],
  [/\bbachelor\W+of\W+management\W+studies\b/g, "bms"],
  [/\bb\W{0,3}(a|sc|com|voc|tech|ed|el|lib)\b/g, "b$1"],
];

// Same word, different spelling — applied to both the query and the course name.
const SAME: Record<string, string> = {
  h: "hons",
  hon: "hons",
  honours: "hons",
  honors: "hons",
  p: "prog",
  programme: "prog",
  program: "prog",
  maths: "mathematics",
  stats: "statistics",
  socialogy: "sociology", // DU's own typo in "B.A (hons) Socialogy"
  // "pol" alone is also a prefix of "Polymer Science".
  pol: "political",
  polsci: "politicalscience",
  polscience: "politicalscience",
  evs: "environmental",
};

const DEGREES = new Set(["ba", "bsc", "bcom", "bvoc", "btech", "bba", "bms"]);
// A degree also answers to what it stands for: "commerce" finds B.Com.
const DEGREE_MEANS: Record<string, string> = { ba: "arts", bsc: "science", bcom: "commerce" };
// Skipped when reading initials, so "hrm" = Human Resource Management, "hdfe" = Human Development and Family Environment.
const STOP = new Set(["and", "of", "in", "with", "as", "the", "for", "to"]);

function words(v: string) {
  let s = v.toLowerCase();
  for (const [re, to] of PHRASES) s = s.replace(re, to);
  return s
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => SAME[w] ?? w);
}

// Can `w` be spelled as prefixes of consecutive words starting at hay[i]?
// "polsci" = "pol"(itical) + "sci"(ence). Chunks need 2+ letters, except the
// last one, which may be a half-typed single letter ("bcomh").
function spells(w: string, hay: string[], i: number): boolean {
  if (!w) return true;
  const word = hay[i];
  if (!word) return false;
  let k = 0;
  while (k < w.length && k < word.length && w[k] === word[k]) k++;
  for (; k >= 1; k--) {
    if (k === w.length || (k >= 2 && spells(w.slice(k), hay, i + 1))) return true;
  }
  return false;
}

export function searchMatch(haystack: string, needle: string) {
  // Nothing typed = no filter (the /papers course list starts unfiltered).
  if (!needle.trim()) return true;
  const squash = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Plain substring only from 3 letters: "cs" inside "economiCS" isn't a hit.
  const q = squash(needle);
  if (q.length >= 3 && squash(haystack).includes(q)) return true;

  const hay = words(haystack);
  const initials = hay.filter((w) => !STOP.has(w)).map((w) => w[0]).join("");
  const extra = hay.flatMap((w) => DEGREE_MEANS[w] ?? []);
  const all = [...hay, ...extra];
  let terms = words(needle);
  // "ba hons history" should still find "History Honours", which never prints its degree.
  if (!hay.some((w) => DEGREES.has(w))) terms = terms.filter((w) => !DEGREES.has(w));
  return (
    terms.length > 0 &&
    terms.every(
      (w) => all.some((_, i) => spells(w, all, i)) || (w.length >= 2 && /^[a-z]+$/.test(w) && initials.includes(w)),
    )
  );
}
