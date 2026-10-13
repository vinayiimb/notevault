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

export const DIAGRAM_MARKER = "<!-- diagram -->";

/** Text a diagram is drawn from: the heading above the marker and the instructions below it. */
export function diagramContext(answer: string, markerIndex: number): string {
  const before = answer.slice(0, markerIndex).split("\n").reverse().find((l) => /^#{2,4}\s/.test(l)) ?? "";
  const after = answer.slice(markerIndex + DIAGRAM_MARKER.length).split(/\n#{2,4}\s/)[0];
  return `${before.replace(/^#+\s*/, "")}\n${after.trim()}`.slice(0, 1500);
}

const QUESTION_HEADING = /^##\s+(.+?)\s+[—–-]\s+QUESTION\s+(.+?)\s*$/i;

// ChatGPT copies LaTeX as \\[ … \\] (or \[ … \]) and \\( … \\) with escaped _ < %;
// remark-math wants $$ … $$ and $ … $.
export function normalizeMath(md: string): string {
  // \| is GFM's escaped table pipe; in LaTeX it would be ‖, so use \vert.
  const fix = (m: string) =>
    m.replace(/\\_/g, "_").replace(/\\</g, "<").replace(/\\\\%/g, "\\%").replace(/\\\\&/g, "\\&").replace(/\\\|/g, "\\vert ");
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
    // ChatGPT's hot-linked web images (third-party diagrams on expiring
    // URLs) become a hidden DIAGRAM_MARKER for the admin's "Draw diagrams"
    // step; the source line under each is dropped, the "Draw …" text stays.
    answer = answer
      .split("\n")
      .filter((line, i, all) => !(/^\[[^\]]+\]\(https?:\/\/[^)]+\)\s*$/.test(line.trim()) && /images\.openai\.com/.test(all.slice(Math.max(0, i - 3), i).join(" "))))
      .map((line) => (/images\.openai\.com/.test(line) ? `\n${DIAGRAM_MARKER}\n` : line))
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

// ---------- Admin's coded SVG diagram library (one HTML file of cards) ----------

export type LibraryDiagram = { title: string; svg: string };

/** `<h3>N. Title</h3><svg …>…</svg>` cards, as in business_economics_coded_diagrams.html. */
export function parseDiagramLibrary(html: string): LibraryDiagram[] {
  return [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>\s*(<svg[\s\S]*?<\/svg>)/gi)].map((m) => ({
    title: m[1].replace(/<[^>]+>/g, "").replace(/^\s*\d+\.\s*/, "").trim(),
    svg: m[2],
  }));
}

/** Library diagram whose title words best appear in the context; null if none share a word. */
export function bestDiagram(context: string, library: LibraryDiagram[]): LibraryDiagram | null {
  const ctx = tokens(context);
  let best: LibraryDiagram | null = null;
  let bestScore = 0;
  let bestShared = 0;
  for (const d of library) {
    const t = tokens(d.title);
    if (!t.size) continue;
    let shared = 0;
    for (const w of t) if (ctx.has(w)) shared++;
    const score = shared / t.size;
    if (shared && (score > bestScore || (score === bestScore && shared > bestShared))) [best, bestScore, bestShared] = [d, score, shared];
  }
  return bestScore >= 0.3 ? best : null;
}

export function libraryFigure(d: LibraryDiagram): string {
  return `\n\n<figure class="pyq-svg">${d.svg.replace(/\n\s*\n/g, "\n")}<figcaption>${d.title.replace(/[<>&]/g, "")}</figcaption></figure>\n\n`;
}

/** Replaces each DIAGRAM_MARKER with its best library match; returns the new answer and how many were filled. */
export function fillDiagramsFromLibrary(question: string, answer: string, library: LibraryDiagram[]) {
  let filled = 0;
  let out = answer;
  let from = 0;
  for (let at = out.indexOf(DIAGRAM_MARKER, from); at !== -1; at = out.indexOf(DIAGRAM_MARKER, from)) {
    const match = bestDiagram(`${question}\n${diagramContext(out, at)}`, library);
    if (!match) {
      from = at + DIAGRAM_MARKER.length;
      continue;
    }
    const fig = libraryFigure(match);
    out = out.slice(0, at) + fig + out.slice(at + DIAGRAM_MARKER.length);
    from = at + fig.length;
    filled++;
  }
  return { answer: out, filled };
}

// ---------- ChatGPT prompt the admin copies per subject ----------
// Produces text in exactly the format parseSolvedText() reads, with diagrams
// as inline SVG in the coded-diagram-library style (solution.css classes).

export type PromptSubject = { course: string; semester: number; subject: string; upc: string | null; paperType: string | null; year: string };

export function solvedPaperPrompt(s: PromptSubject): string {
  const head = s.subject.toUpperCase();
  const code = [s.paperType, s.upc && `UPC ${s.upc}`].filter(Boolean).join(", ");
  return `You are a Delhi University (DU) examiner and topper writing complete, exam-ready solved answers.

Paper: ${s.subject}${code ? ` (${code})` : ""}
Course: ${s.course} · Semester ${s.semester} · NEP (UGCF 2022) syllabus${/^(19|20)\d{2}$/.test(s.year) ? ` · Exam year ${s.year}` : ""}

I will paste the question paper after this message. Solve EVERY question — every sub-part and every OR alternative.

OUTPUT FORMAT (software imports it — follow it exactly):
1. Start each question with its own line:
   ## ${head} — QUESTION 1(a)
   Use the number exactly as printed: 1(a), 1(b), 2, 3(c). Mark alternatives like: QUESTION 1(a) OR
2. Next line: Question: <the full question exactly as printed, on one paragraph>
3. Blank line, then: Unit tag: Unit N — <unit name from the official DU syllabus of this paper>
4. Then the full answer in Markdown:
   - Steps as ### headings: ### 1. Meaning, ### 2. Explanation, ### 3. Formula, ### 4. Diagram … (never use # or ## inside an answer)
   - Length to suit the marks (a 9–15 mark answer ≈ 500–900 words), in simple exam language, ending with a "Conclusion:" paragraph.
   - Formulas in LaTeX: inline \\( … \\), display \\[ … \\]. Show every numerical step and box the final answer with \\boxed{…}.
   - Tables as Markdown pipe tables.
   - Flowcharts as \`\`\`mermaid code blocks.
   - Every diagram as ONE inline <svg> (no images, no links), placed where it belongs, with no blank lines inside it, followed by one line telling the student what to draw. Use this exact style:
     <svg class="diagram" viewBox="0 0 440 300"><path class="axis" d="M55 25V250H405"/><text x="18" y="22">Price</text><text x="335" y="280">Quantity</text><path class="curve blue" d="M95 55L365 220"/><text x="370" y="225">D</text><text x="42" y="265">O</text></svg>
     Classes: axis = axes · curve + blue/green/red/purple = curves (red for the new or shifted curve) · dash = dashed · guide = dotted guide line · dot = point (<circle class="dot" r="4">). Label every axis, curve, equilibrium point and axis value with Unicode subscripts (D₁, S₂, P₁, Qₑ, E₁). Make sure points sit exactly where curves cross.
5. Write nothing before the first ## line and nothing after the last answer: no introduction, no web links, no citations, no college names, no images.

Example of one question:

## ${head} — QUESTION 1(a)
Question: <question text>

Unit tag: Unit 1 — <unit name>

### 1. Meaning
…

### 2. Diagram
<svg class="diagram" viewBox="0 0 440 300">…</svg>
Draw … 

Conclusion: …`;
}
