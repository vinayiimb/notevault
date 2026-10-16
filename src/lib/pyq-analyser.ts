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
  /** answer is an HTML bundle, loaded from /api/pyq-answer when shown */
  bundle?: boolean;
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

// ---------- Saved-question management (admin) ----------

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Same question saved twice: identical text, or same printed number and a
 * repeat-level match. Returns duplicate id → the id it duplicates (the one
 * with the longest answer, oldest on a tie), which is the one to keep.
 */
export function findDuplicates<T extends { id: string; questionNumber: string | null; questionText: string; answerLength: number; createdAt: Date | string }>(qs: T[]): Map<string, string> {
  const order = [...qs].sort((a, b) => b.answerLength - a.answerLength || +new Date(a.createdAt) - +new Date(b.createdAt));
  const keep: T[] = [];
  const dupOf = new Map<string, string>();
  for (const q of order) {
    const same = keep.find(
      (k) => norm(k.questionText) === norm(q.questionText) || (!!q.questionNumber && norm(k.questionNumber ?? "") === norm(q.questionNumber) && similarity(k.questionText, q.questionText) >= REPEAT_THRESHOLD),
    );
    if (same) dupOf.set(q.id, same.id);
    else keep.push(q);
  }
  return dupOf;
}

/** Questions saved by one upload are created seconds apart; a gap over `gapMs` starts a new upload. Oldest upload first. */
export function groupUploads<T extends { createdAt: Date | string }>(qs: T[], gapMs = 2 * 60_000): T[][] {
  const sorted = [...qs].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const out: T[][] = [];
  let last = -Infinity;
  for (const q of sorted) {
    const t = +new Date(q.createdAt);
    if (t - last > gapMs || !out.length) out.push([]);
    out[out.length - 1].push(q);
    last = t;
  }
  return out;
}

export function tally(values: string[][]): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const list of values) for (const v of new Set(list)) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

// ---------- Solved Q&A text (the admin's ChatGPT-style paste) ----------
// Format:  "## BUSINESS ECONOMICS (HONS.) — QUESTION 1(a)" / "Question: …" /
// "Unit tag: Unit 1 — …" / answer markdown until the next question or "# UNIT".

export type SolvedQuestion = { group: string; questionNumber: string; questionText: string; unit: string; years: string[]; answer: string };

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
    const q = body.match(/^Question:\s*([\s\S]*?)(?=^Unit tag:|^Years?:|^#{1,4}\s|\n\s*\n)/m);
    const unit = body.match(/^Unit tag:\s*(.+)$/m)?.[1].trim() ?? "";
    const years = parseYears(body.match(/^Years?:\s*(.+)$/m)?.[1]);
    let answer = body;
    if (q) answer = answer.replace(q[0], "");
    answer = answer.replace(/^Unit tag:.*$/m, "").replace(/^Years?:.*$/m, "");
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
      out.push({ group: cur.group, questionNumber: cur.questionNumber, questionText: q[1].trim(), unit, years, answer: normalizeMath(answer) });
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
Course: ${s.course} · Semester ${s.semester} · NEP (UGCF 2022) syllabus${/^(19|20)\d{2}$/.test(s.year) ? ` · If a paper does not show its year, use ${s.year}` : ""}

I will paste the question paper(s) after this message — one paper or several years of this paper together. Solve EVERY question of every paper — every sub-part and every OR alternative.

OUTPUT FORMAT (software imports it — follow it exactly):
1. Start each question with its own line:
   ## ${head} — QUESTION 1(a)
   Use the number exactly as printed: 1(a), 1(b), 2, 3(c). Mark alternatives like: QUESTION 1(a) OR
2. Next line: Question: <the full question exactly as printed, on one paragraph>
3. Blank line, then: Unit tag: Unit N — <unit name from the official DU syllabus of this paper>
   Next line: Year: <the exam year printed on the paper this question comes from, e.g. Year: 2024>. With several papers, every question gets the year of its own paper; if the same question is asked in more than one of the pasted papers, write it once with all its years: Year: 2022, 2024
4. Then the full answer in Markdown:
   - Steps as ### headings: ### 1. Meaning, ### 2. Explanation, ### 3. Formula, ### 4. Diagram … (never use # or ## inside an answer)
   - Length to suit the marks (a 9–15 mark answer ≈ 500–900 words), in simple exam language, ending with a "Conclusion:" paragraph.
   - Formulas in LaTeX: inline \\( … \\), display \\[ … \\]. Show every numerical step and box the final answer with \\boxed{…}.
   - Tables as Markdown pipe tables.
${DIAGRAM_RULES.replace(/^/gm, "   ")}
5. Write nothing before the first ## line and nothing after the last answer: no introduction, no web links, no citations, no college names, no images.

Example of one question:

## ${head} — QUESTION 1(a)
Question: <question text>

Unit tag: Unit 1 — <unit name>
Year: 2024

### 1. Meaning
…

### 2. Diagram
<svg class="diagram" viewBox="0 0 440 300">…</svg>
Draw … 

Conclusion: …`;
}

// ---------- HTML solution bundles (admin-dropped, rendered sandboxed) ----------
// A bundle is a whole self-contained HTML document stored as answerText; the
// student page renders it in a sandboxed iframe (scripts on, no site access).

export function isBundle(answer: string): boolean {
  return /^\s*(<!doctype html|<html[\s>])/i.test(answer);
}

/** Inline sibling .css/.js files the HTML links by name, so the bundle is one document. */
export function inlineBundleAssets(html: string, files: Record<string, string>): string {
  const byName = (href: string) => files[href.split(/[?#]/)[0].split("/").pop() ?? ""];
  return html
    .replace(/<link\b[^>]*\brel=["']?stylesheet["']?[^>]*>/gi, (tag) => {
      const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
      const css = href && !/^https?:/i.test(href) ? byName(href) : undefined;
      return css === undefined ? tag : `<style>${css}</style>`;
    })
    .replace(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, a, src, b) => {
      const js = /^https?:/i.test(src) ? undefined : byName(src);
      const attrs = `${a} ${b}`.trim();
      return js === undefined ? tag : `<script${attrs ? ` ${attrs}` : ""}>${js.replace(/<\/script/gi, "<\\/script")}</script>`;
    });
}

/**
 * A section.q answer is plain static HTML, so it renders natively in the
 * site's own solution style (SolutionMarkdown) rather than in an iframe with
 * the bundle's CSS: only its diagrams and flowcharts keep their own look.
 * Lines are unindented (4 spaces would become a markdown code block).
 */
export function tidyHtmlAnswer(html: string): string {
  return html
    .split("\n")
    .map((l) => l.trimStart())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A saved section.q bundle → its answer HTML (already without heading, question and unit); null for any other answer. */
export function sectionAnswer(answer: string): string | null {
  if (!isBundle(answer)) return null;
  const m = answer.match(/<section\b[^>]*\bclass=["'][^"']*\bq\b[^"']*["'][^>]*>([\s\S]*)<\/section>/i);
  return m ? tidyHtmlAnswer(m[1]) : null;
}

/** "CLIMATOLOGY — QUESTION 1(a)" → { group, questionNumber }; the <h2> of a section.q bundle. */
export function parseQuestionHeading(text: string): { group: string; questionNumber: string } | null {
  const m = text.replace(/\s+/g, " ").trim().match(/^(.+?)\s+[—–-]\s+QUESTION\s+(.+)$/i);
  return m ? { group: m[1].trim(), questionNumber: m[2].trim() } : null;
}

/** Drops a leading "Question:" / "Unit tag:" / "Year:" label. */
export function stripLabel(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/^(question|unit tag|years?)\s*:\s*/i, "");
}

// The diagram + flowchart system (climatology_solved_answers.html). Put first
// in every bundle's <head>, so diagrams render even if the bundle's own CSS
// leaves a class out; the bundle's CSS comes after and wins.
export const BUNDLE_DIAGRAM_CSS = `svg.diagram{display:block;width:100%;max-width:680px;height:auto;margin:12px auto 4px;background:#fff;border:1px solid #dbe2ee;border-radius:10px}
svg.diagram text{font:12.5px "Segoe UI",system-ui,Arial,sans-serif;fill:#1f2937}
svg.diagram text.b{font-weight:700}svg.diagram text.r{fill:#b91c1c}svg.diagram text.bl{fill:#1d4ed8}
svg.diagram .axis{stroke:#111827;stroke-width:2;fill:none;stroke-linecap:round}
svg.diagram .curve{fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
svg.diagram .blue{stroke:#2563eb}svg.diagram .green{stroke:#16a34a}svg.diagram .red{stroke:#dc2626}svg.diagram .purple{stroke:#7c3aed}svg.diagram .gray{stroke:#6b7280}
svg.diagram .dash{stroke-dasharray:8 5}svg.diagram .guide{fill:none;stroke:#6b7280;stroke-width:1.3;stroke-dasharray:2 4}svg.diagram .dot{fill:#111827}
svg.diagram .sea{fill:#e6f2fb}svg.diagram .land{fill:#e8e0c6;stroke:#a39a78;stroke-width:1.5}svg.diagram .rock{fill:#d6d3d1;stroke:#78716c;stroke-width:1.5}
svg.diagram .warm{fill:#fee2e2}svg.diagram .cold{fill:#dbeafe}svg.diagram .cloud{fill:#fff;stroke:#94a3b8;stroke-width:1.5}
svg.diagram .rain{fill:none;stroke:#2563eb;stroke-width:1.6;stroke-dasharray:4 4}svg.diagram .ring{fill:none;stroke:#7c3aed;stroke-width:8;opacity:.75}
svg.diagram .eye{fill:#fff;stroke:#374151;stroke-dasharray:4 3;stroke-width:1.5}svg.diagram .parcel{fill:#fde68a;stroke:#b45309;stroke-width:1.5}
svg.diagram .tri{fill:#2563eb}svg.diagram .semi{fill:#dc2626}
svg.diagram .z-a{fill:#bbf7d0;stroke:#fff;stroke-width:2}svg.diagram .z-b{fill:#fde68a;stroke:#fff;stroke-width:2}svg.diagram .z-c{fill:#bfdbfe;stroke:#fff;stroke-width:2}svg.diagram .z-d{fill:#ddd6fe;stroke:#fff;stroke-width:2}svg.diagram .z-e{fill:#e5e7eb;stroke:#fff;stroke-width:2}
svg.flow text{font-size:12.5px;text-anchor:middle}svg.flow .link{fill:none;stroke:#475569;stroke-width:1.7}svg.flow rect{stroke-width:1.5}
svg.flow rect.n{fill:#eff6ff;stroke:#3b82f6}svg.flow rect.g{fill:#ecfdf5;stroke:#10b981}svg.flow rect.r{fill:#fef2f2;stroke:#ef4444}svg.flow rect.p{fill:#f5f3ff;stroke:#8b5cf6}`;

/** One question's standalone document: the bundle's <head> plus that question's section. */
export function bundleDocument(head: string, section: string, bodyScripts = ""): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${BUNDLE_DIAGRAM_CSS}</style>${head}</head><body>${section}${bodyScripts}</body></html>`;
}

// Shared by both prompts: the diagram + flowchart system, with one real example of each.
const DIAGRAM_RULES = `DIAGRAMS — every diagram is ONE inline <svg> (no images, no links, no blank lines inside it), placed where it belongs, followed by <p class="caption"> (or, in text answers, one line) telling the student what to draw.
- Diagrams and charts: <svg class="diagram" viewBox="0 0 480 310" role="img" aria-label="what it shows">. Classes: axis = axes · curve + blue/green/red/purple/gray = curves (red for the new or shifted curve) · dash = dashed · guide = dotted guide line · dot = point (<circle class="dot" r="4">) · sea, land, rock, warm, cold, cloud, rain, ring, eye, parcel = filled shapes for maps and cross-sections · tri / semi = cold-front triangles / warm-front semicircles · z-a … z-e = zones · <text class="b"> bold, "r" red, "bl" blue. Label every axis, curve, point, zone and value (Unicode subscripts: D₁, S₂, Qₑ).
  Example: <svg class="diagram" viewBox="0 0 440 300" role="img" aria-label="Demand curve"><path class="axis" d="M55 25V250H405"/><text x="18" y="22">Price</text><text x="335" y="280">Quantity</text><path class="curve blue" d="M95 55L365 220"/><text x="370" y="225">D</text><text x="42" y="265">O</text></svg>
- Flowcharts (never Mermaid): <svg class="diagram flow">. Boxes are <rect class="n|g|r|p" rx="9" height="36"> (n = blue step, g = green result, r = red problem, p = purple key idea) with a centred <text> inside; arrows are <path class="link" marker-end="url(#ID-k)"> using straight H/V lines. Put the arrowhead markers in <defs> with ids unique to that flowchart (fl1-k, fl2-k …).
  Example: <svg class="diagram flow" viewBox="0 0 260 130" role="img" aria-label="Flowchart of condensation"><defs><marker id="fl1-k" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#374151"/></marker></defs><path class="link" d="M130 48V82" marker-end="url(#fl1-k)"/><rect class="n" x="30" y="12" width="200" height="36" rx="9"/><text x="130" y="34.5">Moist air rises and cools</text><rect class="g" x="45" y="82" width="170" height="36" rx="9"/><text x="130" y="104.5">Condensation</text></svg>
- Make sure points sit exactly where curves cross, arrows end on box edges and no text overlaps.`;

/** The bundle variant of the prompt: one self-contained HTML file for the whole paper. */
export function solvedBundlePrompt(s: PromptSubject): string {
  const head = s.subject.toUpperCase();
  const code = [s.paperType, s.upc && `UPC ${s.upc}`].filter(Boolean).join(", ");
  return `You are a Delhi University (DU) examiner and topper writing complete, exam-ready solved answers, and a front-end developer.

Paper: ${s.subject}${code ? ` (${code})` : ""}
Course: ${s.course} · Semester ${s.semester} · NEP (UGCF 2022) syllabus${/^(19|20)\d{2}$/.test(s.year) ? ` · If a paper does not show its year, use ${s.year}` : ""}

I will paste the question paper(s) after this message — one paper or several years of this paper together. Solve EVERY question of every paper — every sub-part and every OR alternative.

Return ONE complete, self-contained HTML file (<!DOCTYPE html> … </html>) for the whole paper. Software splits it into questions, so follow this structure exactly:
1. <head>: all CSS in a single <style> block — clean white exam-sheet style, readable on phones (no horizontal scrolling; wide tables sit in <div class="tw"> and scroll inside it). Include CSS for every diagram class below. No JavaScript, no external files, no images, no web fonts (the site shows the answers in its own style; only the diagram classes keep their look).
2. <body><div class="wrap">, then one section per question, sub-part and OR alternative, in this exact shape:
   <section class="q" id="q1a">
   <h2>${head} — QUESTION 1(a)</h2>
   <p class="qtext"><span class="qlabel">Question:</span> the full question exactly as printed</p>
   <span class="unit">Unit II — <unit name from the official DU syllabus of this paper></span>
   <span class="year">2024</span>
   … the complete answer …
   </section>
   Use the number exactly as printed: 1(a), 1(b), 2, 3(c). Mark alternatives like: QUESTION 1(a) OR
   <span class="year"> holds the exam year printed on the paper the question comes from. With several papers, every question gets the year of its own paper (ids must stay unique, e.g. q2024-1a); if the same question is asked in more than one of the pasted papers, write it once with all its years: <span class="year">2022, 2024</span>
3. Answers: numbered <h3> step headings (1. Meaning, 2. Explanation, 3. Diagram …), length to suit the marks (a 9–15 mark answer ≈ 500–900 words), formulas as plain HTML in <div class="formula"> (<sub>/<sup>, fractions as <span class="frac"><span>top</span><span>bottom</span></span>, final answers in <span class="boxed">…</span>), every numerical step shown, HTML tables inside <div class="tw">, and a final <p class="concl"><strong>Conclusion:</strong> …</p>.
4. ${DIAGRAM_RULES}
5. Colours: white answer cards, near-black text, light-grey table borders. Diagram colours only from the classes above.
6. Each section is shown ON ITS OWN, so never refer to another section.
7. Nothing outside the sections except an optional <header> and contents list (they are dropped): no footer, web links, citations or college names.`;
}
