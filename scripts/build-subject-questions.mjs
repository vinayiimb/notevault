// Question text for /papers/<course>/<subject> pages, from the OCR corpus.
// Subject pages were only PDF links (Google: "Crawled – currently not
// indexed"), so each page now shows the newest paper's questions as text.
//
//   node scripts/build-subject-questions.mjs
//
// Reads data/ocr/papers-refined.jsonl (gitignored, ~100MB) and writes
// public/data/subject-questions/<first 4 UPC digits>.json = { upc: { year, session, text } }.
// The output IS committed: production builds don't have the OCR corpus.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const SRC = "data/ocr/papers-refined.jsonl";
const OUT = "public/data/subject-questions";
const MAX_CHARS = 3000;

const DROP = [
  /^=== Page \d+ ===$/,
  /P\.?\s*T\.?\s*O/i,
  /^\(?\d{3,6}\)?(\s+[A-Z0-9]{1,3})?$/, // serial / page headers: "6543 2", "(1500)"
  /roll\s*no/i,
  /^sr\.?\s*no/i,
  /unique paper code|name of (the )?(paper|course)|^semester\s*:|duration|maximum marks/i,
  /question paper contains|printed pages|no\.? of question paper/i,
  /instructions for|attempt (any|all)|compulsory|carry equal marks|marks are indicated|calculator|questions? carr(y|ies)/i,
];
// Bad scans OCR into letter soup; keep a line only if most of its words are
// real English words (macOS system dictionary).
const WORDS = new Set(
  fs.existsSync("/usr/share/dict/words") ? fs.readFileSync("/usr/share/dict/words", "utf8").toLowerCase().split("\n") : [],
);
const isWord = (w) => {
  w = w.toLowerCase();
  return WORDS.has(w) || WORDS.has(w.replace(/(ies)$/, "y")) || WORDS.has(w.replace(/(es|s|ed|ing|ly)$/, ""));
};
export function looksEnglish(line) {
  const toks = line.match(/[A-Za-z]{3,}/g) ?? [];
  if (toks.length < 2) return false;
  return WORDS.size === 0 || toks.filter(isWord).length / toks.length >= 0.5;
}

const INSTRUCTIONS_END = /same medium|throughout the paper|answers may be written/i;

export function extractQuestions(raw) {
  const lines = raw.split("\n").map((l) => l.trim());
  // Skip the cover block: everything up to the last instruction line near the top.
  let start = 0;
  lines.slice(0, 60).forEach((l, i) => {
    if (INSTRUCTIONS_END.test(l)) start = i + 1;
  });
  const kept = [];
  let len = 0;
  for (const l of lines.slice(start)) {
    // DU papers print the whole English paper, then the Hindi one, whose
    // OCR is mostly noise: stop there.
    if (/[ऀ-ॿ]/.test(l)) {
      if (len > 300) break;
      continue;
    }
    if (l.length < 3 || DROP.some((re) => re.test(l))) continue;
    if (!looksEnglish(l)) continue; // marks like "(6)", OCR noise
    if (len + l.length > MAX_CHARS) break;
    kept.push(l);
    len += l.length + 1;
  }
  return kept.join("\n");
}

const THIS_YEAR = new Date().getFullYear();
const yearOf = (s) =>
  Math.max(0, ...((s ?? "").match(/20[12]\d/g) ?? []).map(Number).filter((y) => y <= THIS_YEAR));

function demo() {
  const sample = [
    "=== Page 1 ===", "6543 4", "Unique Paper Code : 2302201101", "Duration: 3 Hours Maximum Marks : 90",
    "Instructions for Candidates", "1. Write your Roll No. on the top immediately.",
    "4. Answers may be written either in English or Hindi; but the same medium should be used throughout the paper.",
    "P.T.O.", "=== Page 2 ===", "6543 2", "1. How does sociological imagination explain personal troubles?",
    "निम्नलिखित प्रश्नों", "(1500)", "2. In what ways is sociology distinct from common sense?",
  ].join("\n");
  const out = extractQuestions(sample);
  console.assert(out === "1. How does sociological imagination explain personal troubles?\n2. In what ways is sociology distinct from common sense?", out);
  console.assert(!looksEnglish("IDAI Baha (0L) back fois # malte dE o MONDE") && looksEnglish("Explain the concept of financial planning."));
  console.assert(yearOf("NOV-DEC-2025 2025") === 2025 && yearOf(null) === 0 && yearOf("Sr 2027 2024") === 2024);
}

async function main() {
  demo();
  const best = new Map(); // upc -> { year, session, text }
  const rl = readline.createInterface({ input: fs.createReadStream(SRC) });
  let bad = 0;
  for await (const line of rl) {
    let r;
    try {
      r = JSON.parse(line);
    } catch {
      bad++; // a few rows in the corpus are truncated
      continue;
    }
    const raw = r.text ?? "";
    const upc = (`${r.note ?? ""} ${raw.slice(0, 1500)}`.match(/(?:UPC|Unique Paper Code)\s*[:\-]?\s*(\d{8,10})/i) ?? [])[1];
    if (!upc) continue;
    const year = yearOf(r.year) || yearOf(raw.slice(0, 1500));
    const prev = best.get(upc);
    if (prev && prev.year >= year) continue;
    const text = extractQuestions(raw);
    if (text.length < 200) continue;
    const session = (r.note ?? "").match(/(?:NOV|DEC|MAY|JUN|JAN)[A-Z-]*\d{4}/)?.[0] ?? "";
    best.set(upc, { year, session, text });
  }
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const shards = new Map();
  for (const [upc, v] of best) {
    const k = upc.slice(0, 4);
    if (!shards.has(k)) shards.set(k, {});
    shards.get(k)[upc] = v;
  }
  for (const [k, v] of shards) fs.writeFileSync(path.join(OUT, `${k}.json`), JSON.stringify(v));
  console.log(`${bad} unreadable rows skipped`);
  console.log(`${best.size} paper codes with question text → ${shards.size} shards in ${OUT}`);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) await main();
