// IIT JAM Economics (EN) solved papers for /jameco. Client-safe: parsing and
// answer checking only; the page reads src/data/jam-economics/<year>.md at build.
//
// File format, one block per question:
//   ## Q12
//   meta: MCQ | 2 | B            type | marks | key
//   tags: Statistics | Probability theory
//   question stem (markdown + $math$), then option lines "(A) …" … "(D) …"
//   ---
//   solution markdown
// Keys: "B" (MCQ), "A,C" (MSQ), "9.25" / "0.41..0.43" / "4 or 600" (NAT),
// "all" when IIT gave marks to all.

import { normalizeMath } from "@/lib/pyq-analyser";

export type JamType = "MCQ" | "MSQ" | "NAT";

export type JamQuestion = {
  id: string;
  year: string;
  number: number;
  type: JamType;
  marks: number;
  key: string;
  unit: string;
  topic: string;
  stem: string;
  options: { label: string; text: string }[];
  solution: string;
};

export const JAM_UNITS = ["Mathematics", "Statistics", "Microeconomics", "Macroeconomics", "Indian Economy"] as const;

export function parseJamPaper(year: string, md: string): JamQuestion[] {
  return md
    .replace(/\r\n?/g, "\n")
    .split(/^## Q(?=\d+\s*$)/m)
    .slice(1)
    .map((block) => {
      const [head, ...rest] = block.split(/^---\s*$/m);
      const lines = head.split("\n");
      const number = Number(lines[0].trim());
      const meta = lines.find((l) => l.startsWith("meta:"))?.slice(5).split("|").map((s) => s.trim()) ?? [];
      const tags = lines.find((l) => l.startsWith("tags:"))?.slice(5).split("|").map((s) => s.trim()) ?? [];
      const body = lines.slice(1).filter((l) => !/^(meta|tags):/.test(l));
      const options = body.flatMap((l) => {
        const m = l.match(/^\(([A-D])\)\s+(.*)$/);
        return m ? [{ label: m[1], text: m[2].trim() }] : [];
      });
      const stem = body.filter((l) => !/^\([A-D]\)\s/.test(l)).join("\n").trim();
      const [type, marks, key] = meta;
      if (!number || !/^(MCQ|MSQ|NAT)$/.test(type) || !key || tags.length < 2) throw new Error(`JAM ${year} Q${lines[0]}: bad meta/tags`);
      return {
        id: `${year}-${number}`,
        year,
        number,
        type: type as JamType,
        marks: Number(marks),
        key,
        unit: tags[0],
        topic: tags[1],
        // Solutions keep ChatGPT's \( … \) / \[ … \] LaTeX as pasted.
        stem: normalizeMath(stem),
        options: options.map((o) => ({ ...o, text: normalizeMath(o.text) })),
        solution: normalizeMath(rest.join("---").trim()),
      };
    });
}

/** "4 or 600" / "0.41..0.43" / "9" → numeric ranges. */
function natRanges(key: string): [number, number][] {
  return key.split(/\s+or\s+/).map((part) => {
    const [lo, hi = lo] = part.split("..").map(Number);
    return [lo, hi];
  });
}

/** Display form of the key: "A, C", "0.41 to 0.43", "Marks to all". */
export function keyLabel(q: Pick<JamQuestion, "type" | "key">): string {
  if (q.key === "all") return "Marks to all";
  if (q.type !== "NAT") return q.key.split(",").join(", ");
  return natRanges(q.key)
    .map(([lo, hi]) => (lo === hi ? String(lo) : `${lo} to ${hi}`))
    .join(" or ");
}

/**
 * True/false for an attempt; null when the question was "marks to all".
 * MCQ/MSQ: the chosen letters must match the key exactly (no part marks in JAM MSQ).
 */
export function checkAnswer(q: Pick<JamQuestion, "type" | "key">, response: string | string[]): boolean | null {
  if (q.key === "all") return null;
  if (q.type === "NAT") {
    const v = Number(String(response).trim().replace(/[,\s]/g, "").replace(/^−/, "-"));
    if (!Number.isFinite(v)) return false;
    return natRanges(q.key).some(([lo, hi]) => v >= lo - 1e-9 && v <= hi + 1e-9);
  }
  const picked = [...(Array.isArray(response) ? response : [response])].sort().join(",");
  return picked === q.key.split(",").sort().join(",");
}
