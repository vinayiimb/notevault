// Pure helpers for the PYQ Analyser (client-safe, no Prisma): year parsing,
// "same question in another year" matching, and topic/year tallies.

export type AnalyserQuestion = {
  id: string;
  number: string | null;
  text: string;
  answer: string;
  marks: number | null;
  years: string[];
  section: string | null;
  topics: string[];
  difficulty: "EASY" | "MEDIUM" | "HARD" | null;
  repeatCount: number;
};

export function parseYears(raw: string | null | undefined): string[] {
  const years = (raw ?? "").match(/\b(19|20)\d{2}\b/g) ?? [];
  return [...new Set(years)].sort();
}

const STOP = new Set(
  "a an the of and or in on to for with by is are be as at from that this its it what how why explain discuss describe define write short note notes briefly detail examine critically state distinguish between".split(" "),
);

// Content words cut to 6 letters — a crude stem so "determinants" and
// "determine" count as the same word.
function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => w.slice(0, 6)),
  );
}

// Jaccard overlap catches straight re-wordings. DU also re-asks a long
// question as a short one (or the reverse), so if ≥4 content words are
// shared and the shorter one is ≥80% inside the longer, that counts too.
// ponytail: O(new × existing) scan per save; fine for a few hundred questions per subject.
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  const jaccard = shared / (ta.size + tb.size - shared);
  const contained = shared / Math.min(ta.size, tb.size);
  return shared >= 4 && contained >= 0.8 ? Math.max(jaccard, contained * 0.75) : jaccard;
}

export const REPEAT_THRESHOLD = 0.6;

export function findRepeat<T extends { questionText: string }>(text: string, existing: T[]): T | null {
  let best: T | null = null;
  let bestScore = REPEAT_THRESHOLD;
  for (const q of existing) {
    const score = similarity(text, q.questionText);
    if (score >= bestScore) {
      best = q;
      bestScore = score;
    }
  }
  return best;
}

export function tally(values: string[][]): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const list of values) for (const v of new Set(list)) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

// ---------- Solved Q&A text (the admin's ChatGPT-style paste) ----------
// Format:  "## BUSINESS ECONOMICS (HONS.) — QUESTION 1(a)" / "Question: …" /
// "Unit tag: Unit 1 — …" / answer markdown until the next question or "# UNIT".

export type SolvedQuestion = { group: string; questionNumber: string; questionText: string; unit: string; answer: string };

const QUESTION_HEADING = /^##\s+(.+?)\s+[—–-]\s+QUESTION\s+(.+?)\s*$/i;

// ChatGPT copies LaTeX as \\[ … \\] (or \[ … \]) and \\( … \\) with escaped _ < %;
// remark-math wants $$ … $$ and $ … $.
export function normalizeMath(md: string): string {
  const fix = (m: string) => m.replace(/\\_/g, "_").replace(/\\</g, "<").replace(/\\\\%/g, "\\%").replace(/\\\\&/g, "\\&");
  return md
    .replace(/\\\\?\[([\s\S]*?)\\\\?\]/g, (_, m) => `\n$$\n${fix(m).trim()}\n$$\n`)
    .replace(/\\\\?\(([\s\S]*?)\\\\?\)/g, (_, m) => `$${fix(m).trim()}$`);
}

export function parseSolvedText(text: string): SolvedQuestion[] {
  const out: SolvedQuestion[] = [];
  let cur: { group: string; questionNumber: string; lines: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    const body = cur.lines.join("\n");
    const q = body.match(/^Question:\s*([\s\S]*?)(?=^Unit tag:|^#{1,4}\s|\n\s*\n)/m);
    const unit = body.match(/^Unit tag:\s*(.+)$/m)?.[1].trim() ?? "";
    let answer = body;
    if (q) answer = answer.replace(q[0], "");
    answer = answer.replace(/^Unit tag:.*$/m, "");
    // Drop ChatGPT's hot-linked web images and the source line under each:
    // third-party diagrams on expiring URLs. The "Draw …" guidance stays.
    answer = answer
      .split("\n")
      .filter((line, i, all) => !/images\.openai\.com/.test(line) && !(/^\[[^\]]+\]\(https?:\/\/[^)]+\)\s*$/.test(line.trim()) && /images\.openai\.com/.test(all.slice(Math.max(0, i - 3), i).join(" "))))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (q && q[1].trim()) {
      out.push({ group: cur.group, questionNumber: cur.questionNumber, questionText: q[1].trim(), unit, answer: normalizeMath(answer) });
    }
    cur = null;
  };
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const h = line.match(QUESTION_HEADING);
    if (h) {
      flush();
      cur = { group: h[1].trim(), questionNumber: h[2].trim(), lines: [] };
    } else if (/^#{1,2}\s|^##\s*$/.test(line)) {
      flush(); // "# UNIT 2 …" or a stray "##" ends the current answer
    } else {
      cur?.lines.push(line);
    }
  }
  flush();
  return out;
}
