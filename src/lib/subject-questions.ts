import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

export type SubjectQuestions = { upc: string; year: number; session: string; text: string };

// Newest paper's question text per UPC, built by scripts/build-subject-questions.mjs
// into small shards so a page render reads ~30KB, never the whole corpus.
export async function getSubjectQuestions(codes: string[]): Promise<SubjectQuestions | null> {
  let best: SubjectQuestions | null = null;
  for (const upc of codes) {
    if (!/^\d{8,10}$/.test(upc)) continue;
    try {
      const file = path.join(process.cwd(), "public", "data", "subject-questions", `${upc.slice(0, 4)}.json`);
      const hit = JSON.parse(await fs.readFile(file, "utf8"))[upc];
      if (hit && (!best || hit.year > best.year)) best = { upc, ...hit };
    } catch {
      // no shard for this code
    }
  }
  return best;
}

/** First question of a paper, trimmed to a one-paragraph sample. */
export function firstQuestion(text: string): string {
  let out = "";
  for (const line of text.split("\n")) {
    out += (out ? " " : "") + line;
    if (out.length >= 90) break;
  }
  out = out.replace(/^(Q\.?\s*)?(\d+\s*[.:)]\s*)?(\([a-z]\)\s*)?/i, "");
  out = out.split(/\s(?:Q\.?\s*)?\d+\s*\.\s|\s\([b-z]\)\s/i)[0]; // stop at the next question/part
  return out.length > 220 ? `${out.slice(0, 220).replace(/\s+\S*$/, "")}…` : out;
}

export type SampleQuestion = { name: string; href: string; year: number; question: string };

/** One real question per subject, for course and semester pages. */
export async function getSampleQuestions(
  subjects: { name: string; href: string; paperCodes: string[] }[],
  limit: number,
): Promise<SampleQuestion[]> {
  const out: SampleQuestion[] = [];
  for (const s of subjects) {
    if (out.length >= limit) break;
    const q = await getSubjectQuestions(s.paperCodes);
    const question = q && firstQuestion(q.text);
    if (question && question.length >= 30) out.push({ name: s.name, href: s.href, year: q.year, question });
  }
  return out;
}
