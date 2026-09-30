import { z } from "zod";
import { getAllGradeThresholds } from "@/lib/calculator";

// ── The prompt students paste into ChatGPT / Gemini / Claude with their marksheet ──

export const MARKSHEET_PROMPT = `You are reading a University of Delhi (DU) "Statement of Marks / Grades" (marksheet). Convert it into JSON exactly as described below. Accuracy matters more than speed — re-read every row before answering.

PRIVACY: Do NOT include the student's name, roll number, enrolment number, father's or mother's name, photo, QR code or college name anywhere in your answer.

Return ONLY one JSON object, inside a single \`\`\`json code block, with this shape:

{
  "programme": "Bachelor of Commerce",
  "examSession": "May-June 2026",
  "papers": [
    {
      "upc": "2412091101",
      "title": "BUSINESS ORGANISATION AND MANAGEMENT",
      "type": "DSC",
      "semester": 1,
      "credits": 4,
      "gradeL": "A",
      "gradeT": "A+",
      "gradeP": null,
      "finalGrade": "A",
      "gradePoint": 8,
      "creditPoints": 32,
      "status": null
    }
  ],
  "semesters": [
    { "semester": 1, "totalCredits": 22, "totalCreditPoints": 184, "sgpa": 8.36, "cgpa": null, "result": null }
  ]
}

Column guide (marksheet header → JSON field):
- UPC → "upc" (digits only, drop any * mark)
- Paper Title → "title" (copy exactly; keep Hindi titles in Hindi)
- PPT → "type" (e.g. DSC, DSE, GE, GEL, AEC, SEC, VAC)
- SEM → "semester" as a number (I→1, II→2, III→3, IV→4 …)
- CRDT → "credits"
- GR(L) → "gradeL", GR(T) → "gradeT", GR(P) → "gradeP" — use null when the cell is empty
- NTGR → "finalGrade"
- GRPT → "gradePoint"
- CRPT → "creditPoints"
- PPRS → "status" (null when empty, otherwise copy it exactly, e.g. "ER")
- Summary table: SEM → "semester", TTCR → "totalCredits", TTCP → "totalCreditPoints", SGPA → "sgpa", CGPA → "cgpa" (null when empty), RESULT → "result" (null when empty)

Rules:
- One entry in "papers" for EVERY row of the paper table. Do not skip, merge or reorder rows.
- Grades are one of: O, A+, A, B+, B, C, D, P, F. Write "A+", never "A +".
- Numbers must be plain numbers, not strings.
- If a cell is unreadable, use null. Never guess.
- If you are given more than one marksheet, merge all their papers and semesters into the one object.`;

// ── Grade scale ──

export const GRADE_POINTS: Record<string, number> = { O: 10, "A+": 9, A: 8, "B+": 7, B: 6, C: 5, D: 4, P: 4, F: 0 };

// Percentage band [low, high) behind each grade, from the same table the
// marks calculator uses so both tools agree.
const BANDS: Record<string, [number, number]> = (() => {
  const rows = getAllGradeThresholds();
  const bands: Record<string, [number, number]> = {};
  rows.forEach((row, i) => {
    bands[row.grade] = [row.min, i === 0 ? 100 : rows[i - 1].min];
  });
  bands.P = bands.D;
  return bands;
})();

export function gradeBand(grade: string | null): [number, number] | null {
  return grade ? BANDS[grade] ?? null : null;
}

// ── Parsing ──

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };

function toGrade(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const g = value.replace(/\s+/g, "").toUpperCase();
  return g in GRADE_POINTS ? g : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function toSemester(value: unknown): unknown {
  if (typeof value === "string") {
    const v = value.trim().toUpperCase();
    return ROMAN[v] ?? toNumber(v) ?? value;
  }
  return value;
}

function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

const grade = z.unknown().transform(toGrade);
const num = z.unknown().transform(toNumber);
const text = z.unknown().transform(toText);

const PaperSchema = z.object({
  upc: text,
  title: z.string().trim().min(1),
  type: text,
  semester: z.preprocess(toSemester, z.number().int().min(1).max(10)),
  credits: z.preprocess(toNumber, z.number().min(0).max(30)),
  gradeL: grade,
  gradeT: grade,
  gradeP: grade,
  finalGrade: grade,
  gradePoint: num,
  creditPoints: num,
  status: text,
});

const SemesterSchema = z.object({
  semester: z.preprocess(toSemester, z.number().int().min(1).max(10)),
  totalCredits: num,
  totalCreditPoints: num,
  sgpa: num,
  cgpa: num,
  result: text,
});

const MarksheetSchema = z.object({
  programme: text,
  examSession: text,
  papers: z.array(PaperSchema).min(1),
  semesters: z.array(SemesterSchema).default([]),
});

export type Marksheet = z.infer<typeof MarksheetSchema>;
export type Paper = z.infer<typeof PaperSchema>;

export function parseMarksheet(input: string): { ok: true; data: Marksheet } | { ok: false; error: string } {
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return { ok: false, error: "No JSON found. Paste the whole answer the AI gave you, including the { and } brackets." };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(input.slice(start, end + 1));
  } catch {
    return { ok: false, error: "The answer isn’t valid JSON — it may have been cut off. Ask the AI to “send the complete JSON again” and paste that." };
  }
  const result = MarksheetSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue.path.length ? ` (at ${issue.path.join(" → ")})` : "";
    return { ok: false, error: `The JSON is missing something we need${where}: ${issue.message}. Ask the AI to follow the prompt’s format exactly.` };
  }
  return { ok: true, data: result.data };
}

// ── Analysis ──

export type Level = "critical" | "warning" | "good" | "info";
export interface Finding {
  level: Level;
  title: string;
  detail: string;
}

export type ComponentKey = "L" | "T" | "P";
export const COMPONENT_NAME: Record<ComponentKey, string> = { L: "Theory", T: "Tutorial", P: "Practical" };

export interface PaperView extends Paper {
  id: string;
  gp: number | null;
  cp: number | null;
  components: { key: ComponentKey; grade: string }[];
  anomaly: boolean;
  weakComponent: { key: ComponentKey; grade: string; strongKey: ComponentKey; strongGrade: string } | null;
}

export interface SemesterView {
  semester: number;
  credits: number;
  creditPoints: number;
  sgpa: number;
  printedSgpa: number | null;
  printedCgpa: number | null;
  // DU prints CGPA per year (Part): semesters 1+2, 3+4, … — set on even semesters.
  yearCgpa: number | null;
  result: string | null;
  matches: boolean | null;
}

export interface Analysis {
  programme: string | null;
  examSession: string | null;
  papers: PaperView[];
  semesters: SemesterView[];
  cgpa: number;
  totalCredits: number;
  totalCreditPoints: number;
  findings: Finding[];
  byType: { type: string; credits: number; avgGp: number; papers: number }[];
  byComponent: { key: ComponentKey; avgGp: number; papers: number }[];
  strongest: PaperView[];
  weakest: PaperView[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function toView(paper: Paper, index: number): PaperView {
  const gp = paper.finalGrade ? GRADE_POINTS[paper.finalGrade] : paper.gradePoint;
  const byKey = { L: paper.gradeL, T: paper.gradeT, P: paper.gradeP };
  const components = (["L", "T", "P"] as const)
    .map((key) => ({ key, grade: byKey[key] }))
    .filter((c): c is { key: ComponentKey; grade: string } => c.grade !== null);

  // The final grade is a weighted mix of the components, so its band must
  // overlap the span of the component bands whatever the weights are.
  let anomaly = false;
  const finalBand = gradeBand(paper.finalGrade);
  const bands = components.map((c) => gradeBand(c.grade)).filter((b): b is [number, number] => b !== null);
  if (finalBand && bands.length) {
    const lo = Math.min(...bands.map((b) => b[0]));
    const hi = Math.max(...bands.map((b) => b[1]));
    anomaly = finalBand[1] <= lo || finalBand[0] >= hi;
  }

  let weakComponent: PaperView["weakComponent"] = null;
  if (components.length > 1) {
    const sorted = [...components].sort((a, b) => GRADE_POINTS[a.grade] - GRADE_POINTS[b.grade]);
    const weak = sorted[0];
    const strong = sorted[sorted.length - 1];
    if (GRADE_POINTS[strong.grade] - GRADE_POINTS[weak.grade] >= 2) {
      weakComponent = { key: weak.key, grade: weak.grade, strongKey: strong.key, strongGrade: strong.grade };
    }
  }

  return {
    ...paper,
    id: `${paper.semester}-${paper.upc ?? paper.title}-${index}`,
    gp,
    cp: gp === null ? null : gp * paper.credits,
    components,
    anomaly,
    weakComponent,
  };
}

export function analyseMarksheet(sheet: Marksheet): Analysis {
  const papers = sheet.papers.map(toView).sort((a, b) => a.semester - b.semester);
  const graded = papers.filter((p) => p.gp !== null);
  const findings: Finding[] = [];

  const semesterNumbers = [...new Set(papers.map((p) => p.semester))].sort((a, b) => a - b);
  const semesters: SemesterView[] = semesterNumbers.map((semester) => {
    const rows = graded.filter((p) => p.semester === semester);
    const credits = rows.reduce((s, p) => s + p.credits, 0);
    const creditPoints = rows.reduce((s, p) => s + (p.cp ?? 0), 0);
    const sgpa = credits ? creditPoints / credits : 0;
    const printed = sheet.semesters.find((s) => s.semester === semester);
    let matches: boolean | null = null;
    if (printed && (printed.sgpa !== null || printed.totalCreditPoints !== null)) {
      matches =
        (printed.totalCredits === null || printed.totalCredits === credits) &&
        (printed.totalCreditPoints === null || printed.totalCreditPoints === creditPoints) &&
        (printed.sgpa === null || Math.abs(printed.sgpa - sgpa) < 0.011);
    }
    let yearCgpa: number | null = null;
    if (semester % 2 === 0) {
      const year = graded.filter((p) => p.semester === semester || p.semester === semester - 1);
      const yc = year.reduce((s, p) => s + p.credits, 0);
      yearCgpa = yc ? round2(year.reduce((s, p) => s + (p.cp ?? 0), 0) / yc) : null;
    }
    return {
      semester,
      credits,
      creditPoints,
      sgpa: round2(sgpa),
      printedSgpa: printed?.sgpa ?? null,
      printedCgpa: printed?.cgpa ?? null,
      yearCgpa,
      result: printed?.result ?? null,
      matches,
    };
  });

  const totalCredits = graded.reduce((s, p) => s + p.credits, 0);
  const totalCreditPoints = graded.reduce((s, p) => s + (p.cp ?? 0), 0);
  const cgpa = totalCredits ? round2(totalCreditPoints / totalCredits) : 0;

  // Failed / ER papers come first: they need action.
  for (const p of papers) {
    if (p.finalGrade === "F" || (p.status && p.status !== "-")) {
      findings.push({
        level: "critical",
        title: `${p.title} (Sem ${p.semester}) needs to be cleared`,
        detail: `${p.finalGrade === "F" ? "Grade F" : `Marked “${p.status}”`}. You re-appear in this paper when DU next holds exams for semester ${p.semester}’s cycle (${p.semester % 2 ? "odd" : "even"} semesters). Watch the ER/re-appear exam form notice so you don’t miss the fee deadline.`,
      });
    }
  }

  for (const p of papers.filter((p) => p.anomaly)) {
    const comps = p.components.map((c) => `${COMPONENT_NAME[c.key]} ${c.grade}`).join(", ");
    findings.push({
      level: "warning",
      title: `${p.title}: final grade doesn’t fit its parts`,
      detail: `${comps} — but the final grade is ${p.finalGrade}. A mix of those component grades should land in their range, so this looks like a totalling or data-entry slip. Consider asking for a photocopy of the answer sheet or re-evaluation when the window opens.`,
    });
  }

  for (const p of papers) {
    if (p.gradePoint !== null && p.finalGrade && p.gradePoint !== GRADE_POINTS[p.finalGrade]) {
      findings.push({
        level: "warning",
        title: `${p.title}: grade point doesn’t match the grade`,
        detail: `Grade ${p.finalGrade} is worth ${GRADE_POINTS[p.finalGrade]} points, but the row shows ${p.gradePoint}. Check this row on your marksheet — it may have been misread.`,
      });
    } else if (p.creditPoints !== null && p.cp !== null && p.creditPoints !== p.cp) {
      findings.push({
        level: "warning",
        title: `${p.title}: credit points don’t add up`,
        detail: `${p.credits} credits × ${p.gp} = ${p.cp}, but the row shows ${p.creditPoints}. Check this row on your marksheet.`,
      });
    }
  }

  const mismatched = semesters.filter((s) => s.matches === false);
  for (const s of mismatched) {
    findings.push({
      level: "warning",
      title: `Semester ${s.semester} totals don’t match the marksheet`,
      detail: `From the papers we get ${s.credits} credits, ${s.creditPoints} credit points and SGPA ${s.sgpa.toFixed(2)}${s.printedSgpa !== null ? `, but the marksheet says SGPA ${s.printedSgpa.toFixed(2)}` : ""}. Usually the AI misread or skipped a row — compare this semester’s papers below with your marksheet.`,
    });
  }
  if (semesters.some((s) => s.matches === true) && mismatched.length === 0) {
    findings.push({
      level: "good",
      title: "Every semester total adds up",
      detail: "Credits, credit points and SGPA recalculated from your papers match what’s printed on the marksheet, so the data below is reliable.",
    });
  }

  const printedYears = semesters.filter((s) => s.printedCgpa !== null && s.yearCgpa !== null);
  if (semesters.length > 2 && printedYears.length) {
    const yearly = printedYears.map((s) => `semesters ${s.semester - 1}–${s.semester}: ${s.printedCgpa!.toFixed(2)}`).join(", ");
    findings.push({
      level: "info",
      title: `Your cumulative CGPA is ${cgpa.toFixed(2)}, not the last CGPA printed`,
      detail: `The CGPA column on a DU marksheet covers one year at a time (${yearly}). Across all ${semesters.length} semesters — ${totalCreditPoints} credit points over ${totalCredits} credits — it works out to ${cgpa.toFixed(2)}.`,
    });
  }

  const COMPONENT_TIP: Record<ComponentKey, string> = {
    T: "Tutorial marks come from class work, assignments and attendance — the easiest marks to protect next semester.",
    P: "Practical marks depend on lab work, your practical file and the viva — keep records complete and on time.",
    L: "The written exam is where these slipped — practise answer-writing with previous year papers for these subjects.",
  };
  for (const key of ["T", "P", "L"] as const) {
    const slipped = papers.filter((p) => p.weakComponent?.key === key);
    if (!slipped.length) continue;
    const list = slipped
      .map((p) => `${p.title} (${COMPONENT_NAME[p.weakComponent!.strongKey]} ${p.weakComponent!.strongGrade} → ${COMPONENT_NAME[key]} ${p.weakComponent!.grade})`)
      .join("; ");
    findings.push({
      level: "info",
      title: `${COMPONENT_NAME[key]} marks cost you in ${slipped.length} paper${slipped.length > 1 ? "s" : ""}`,
      detail: `${list}. ${COMPONENT_TIP[key]}`,
    });
  }

  if (semesters.length >= 2) {
    const last = semesters[semesters.length - 1];
    const prev = semesters[semesters.length - 2];
    const diff = round2(last.sgpa - prev.sgpa);
    if (diff >= 0.3) {
      findings.push({ level: "good", title: `SGPA up ${diff.toFixed(2)} in semester ${last.semester}`, detail: `From ${prev.sgpa.toFixed(2)} to ${last.sgpa.toFixed(2)}. Whatever changed in how you prepared, keep it.` });
    } else if (diff <= -0.3) {
      findings.push({ level: "warning", title: `SGPA down ${Math.abs(diff).toFixed(2)} in semester ${last.semester}`, detail: `From ${prev.sgpa.toFixed(2)} to ${last.sgpa.toFixed(2)}. Look at the weakest papers below to see where it came from.` });
    }
  }

  const types = [...new Set(graded.map((p) => (p.type ?? "Other").toUpperCase()))];
  const byType = types
    .map((type) => {
      const rows = graded.filter((p) => (p.type ?? "Other").toUpperCase() === type);
      const credits = rows.reduce((s, p) => s + p.credits, 0);
      const cp = rows.reduce((s, p) => s + (p.cp ?? 0), 0);
      return { type, credits, avgGp: credits ? round2(cp / credits) : 0, papers: rows.length };
    })
    .sort((a, b) => b.credits - a.credits);

  const byComponent = (["L", "T", "P"] as const)
    .map((key) => {
      const gps = papers.flatMap((p) => p.components.filter((c) => c.key === key).map((c) => GRADE_POINTS[c.grade]));
      return { key, avgGp: round2(avg(gps)), papers: gps.length };
    })
    .filter((c) => c.papers > 0);

  const ranked = [...graded].sort((a, b) => (b.gp! - a.gp!) || (b.credits - a.credits));
  return {
    programme: sheet.programme,
    examSession: sheet.examSession,
    papers,
    semesters,
    cgpa,
    totalCredits,
    totalCreditPoints,
    findings,
    byType,
    byComponent,
    strongest: ranked.slice(0, 3),
    weakest: ranked.slice(-3).reverse(),
  };
}

// ── Planning helpers ──

// DU converts CGPA to percentage by multiplying by 9.5 (see the blog guide).
export const cgpaToPercent = (cgpa: number) => round2(cgpa * 9.5);

export function requiredSgpa(opts: {
  currentCreditPoints: number;
  currentCredits: number;
  target: number;
  remainingSemesters: number;
  creditsPerSemester: number;
}): number | null {
  const { currentCreditPoints, currentCredits, target, remainingSemesters, creditsPerSemester } = opts;
  const remainingCredits = remainingSemesters * creditsPerSemester;
  if (remainingCredits <= 0) return null;
  const needed = target * (currentCredits + remainingCredits) - currentCreditPoints;
  return round2(needed / remainingCredits);
}

// DU UGCF theory component = end-semester exam + internal assessment. From
// the theory grade band and the internal marks, back out the end-sem score.
export function theoryMaxima(paper: Paper): { theory: number; ia: number } | null {
  if (!paper.gradeL) return null;
  if (paper.credits === 4) return { theory: 90, ia: 30 };
  if (paper.credits === 2 && !paper.gradeP) return { theory: 50, ia: 25 };
  return null;
}

export function estimateEndSem(paper: Paper, internal: number): { low: number; high: number; max: number } | null {
  const maxima = theoryMaxima(paper);
  const band = gradeBand(paper.gradeL);
  if (!maxima || !band || internal < 0 || internal > maxima.ia) return null;
  const total = maxima.theory + maxima.ia;
  const top = band[1] === 100 ? total : (band[1] / 100) * total - 0.01;
  const low = Math.max(0, Math.ceil((band[0] / 100) * total - internal));
  const high = Math.min(maxima.theory, Math.floor(top - internal));
  if (high < low) return null;
  return { low, high, max: maxima.theory };
}
