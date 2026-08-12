/**
 * du-pyp-data.ts — server-side data functions for DU Previous Year Papers.
 * Source: du-question-bank-full-mapped.json (15,165 rows scraped from qb.exam.du.ac.in,
 * matched against the official syllabus catalogue).
 */
import rawQuestionBank from "@/data/du-question-bank-full-mapped.json";

interface RawQuestionBankRow {
  officialProgramme: string;
  semester: string | null;
  paperType: string | null;
  subjectPaperName: string;
  courseNumber: string | null;
  upc: string | null;
  credits: string | null;
  officialPaperLink: string | null;
  questionPaperLink: string | null;
  questionPaperSession: string | null;
  questionPaperYear: string | null;
  questionPaperSet: string | null;
  questionPaperMarks: string | null;
  isShivaji?: boolean;
  isKalindi?: boolean;
  isANDC?: boolean;
  college?: string;
}

export interface DuExamPaper {
  year: string | null;
  session: string | null;
  set: string | null;
  marks: string | null;
  link: string;
  isShivaji?: boolean;
  isKalindi?: boolean;
  isANDC?: boolean;
  college?: string;
}

export interface DuPypPaper {
  programme: string;
  semesters: string[];
  paperType: string;
  subjectName: string;
  canonicalName: string;
  courseNumber: string | null;
  upc: string | null;
  credits: string | null;
  officialLink: string | null; // syllabus PDF
  examPapers: DuExamPaper[]; // real previous year question papers, newest first
}

const ROMAN_ORDER = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

function normalizeSemester(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const s = String(raw).trim();

  if (s.toLowerCase().includes("pool") || s.toLowerCase().includes("not fixed")) return ["Pool"];

  const wordMap: Record<string, string> = {
    "1": "I", "2": "II", "3": "III", "4": "IV",
    "5": "V", "6": "VI", "7": "VII", "8": "VIII",
    "i": "I", "ii": "II", "iii": "III", "iv": "IV",
    "v": "V", "vi": "VI", "vii": "VII", "viii": "VIII",
  };

  const cleaned = s
    .replace(/semester[-–\s]*/gi, "")
    .replace(/\bIIi\b/g, "III")
    .trim();

  const parts = cleaned.split(/[\/,\s]+/).filter(Boolean);
  const sems = new Set<string>();

  for (const part of parts) {
    const key = part.trim().toLowerCase();
    if (wordMap[key]) {
      sems.add(wordMap[key]);
      continue;
    }
    if (/^[IVX]+$/i.test(part)) {
      sems.add(part.toUpperCase());
      continue;
    }
    // Range form, e.g. "I-II", "III-VI"
    const rangeMatch = part.match(/^([IVX]+)-([IVX]+)$/i);
    if (rangeMatch) {
      const startIdx = ROMAN_ORDER.indexOf(rangeMatch[1].toUpperCase());
      const endIdx = ROMAN_ORDER.indexOf(rangeMatch[2].toUpperCase());
      if (startIdx !== -1 && endIdx !== -1 && startIdx <= endIdx) {
        for (let i = startIdx; i <= endIdx; i++) sems.add(ROMAN_ORDER[i]);
      }
    }
  }

  return [...sems].sort((a, b) => ROMAN_ORDER.indexOf(a) - ROMAN_ORDER.indexOf(b));
}

function normalizePaperType(raw: string | null | undefined): string {
  if (!raw) return "Other";
  const s = String(raw).trim();
  const map: Record<string, string> = {
    "DSC/Core": "DSC",
    "DSC": "DSC",
    "Core": "DSC",
    "DSE": "DSE",
    "GE": "GE",
    "AEC": "AEC",
    "SEC": "SEC",
    "VAC": "VAC",
    "Academic Track": "Academic Track",
    "Community Outreach": "Community Outreach",
    "Compulsory": "Compulsory",
  };
  return map[s] ?? s;
}

interface BuiltSubject extends DuPypPaper {
  _examLinkSeen: Set<string>;
}

function buildPapers(): DuPypPaper[] {
  const rows = rawQuestionBank as RawQuestionBankRow[];
  const bySubject = new Map<string, BuiltSubject>();

  for (const row of rows) {
    const programme = (row.officialProgramme ?? "").trim();
    const subjectName = (row.subjectPaperName ?? "").trim();
    if (!programme || !subjectName) continue;

    const semesters = normalizeSemester(row.semester);
    const paperType = normalizePaperType(row.paperType);
    const courseNumber = row.courseNumber?.trim() || null;
    const upc = row.upc?.trim() || null;

    const key = [programme, subjectName, courseNumber ?? "", upc ?? "", paperType].join("||");

    let subject = bySubject.get(key);
    if (!subject) {
      subject = {
        programme,
        semesters,
        paperType,
        subjectName,
        canonicalName: subjectName,
        courseNumber,
        upc,
        credits: row.credits?.trim() || null,
        officialLink: row.officialPaperLink?.trim() || null,
        examPapers: [],
        _examLinkSeen: new Set(),
      };
      bySubject.set(key, subject);
    }

    const link = row.questionPaperLink?.trim();
    if (link && !subject._examLinkSeen.has(link)) {
      subject._examLinkSeen.add(link);
      subject.examPapers.push({
        year: row.questionPaperYear?.trim() || null,
        session: row.questionPaperSession?.trim() || null,
        set: row.questionPaperSet?.trim() || null,
        marks: row.questionPaperMarks?.trim() || null,
        link,
        isShivaji: !!row.isShivaji,
        isKalindi: !!row.isKalindi,
        isANDC: !!row.isANDC,
        college: row.college || (row.isShivaji ? "Shivaji" : row.isKalindi ? "Kalindi" : row.isANDC ? "ANDC" : undefined),
      });
    }
  }

  const papers: DuPypPaper[] = [];
  for (const subject of bySubject.values()) {
    subject.examPapers.sort((a, b) => Number(b.year ?? 0) - Number(a.year ?? 0));
    const { _examLinkSeen, ...rest } = subject;
    void _examLinkSeen;
    papers.push(rest);
  }
  return papers;
}

const allPapers = buildPapers();

export function getTotalDuPypCount(): number {
  return (rawQuestionBank as RawQuestionBankRow[]).length;
}

// All 118 unique official programme names, sorted and grouped
export function getAllDuPypProgrammes(): string[] {
  return [...new Set(allPapers.map((p) => p.programme))].sort((a, b) =>
    a.localeCompare(b)
  );
}

// Group programmes into display categories for the selector UI
export function getGroupedDuPypProgrammes(): Record<string, string[]> {
  const all = getAllDuPypProgrammes();
  const groups: Record<string, string[]> = {
    "B.A. (Honours)": [],
    "B.A. (Programme)": [],
    "B.Sc. (Honours)": [],
    "B.Sc. (Programme)": [],
    "B.Com.": [],
    "B.Voc. / Vocational": [],
    "BBA / BMS / BBE": [],
    "B.Tech.": [],
    "Music & Performing Arts": [],
    "University-wide Pools": [],
    "Other": [],
  };

  for (const prog of all) {
    const p = prog.toLowerCase();
    if (p.includes("ability enhancement") || p.includes("skill enhancement") || p.includes("value addition")) {
      groups["University-wide Pools"].push(prog);
    } else if (p.includes("b.a. (hons") || p.includes("b. a. (hons") || p.includes("b.a (hons") || p.includes("ba (hons") || p.includes("bachelor of arts (hons") || p.includes("history honours") || p.includes("psychology honours") || p.includes("multi media and mass communication")) {
      groups["B.A. (Honours)"].push(prog);
    } else if (p.includes("b.a. (prog") || p.includes("b. a. (prog") || p.includes("b. a program") || p.includes("b.a (prog")) {
      groups["B.A. (Programme)"].push(prog);
    } else if (p.includes("b.sc. (hons") || p.includes("b. sc. (hons") || p.includes("b.sc (hons")) {
      groups["B.Sc. (Honours)"].push(prog);
    } else if (p.includes("b.sc. (prog") || p.includes("b. sc. (prog") || p.includes("b.sc (prog") || p.includes("b.sc. life") || p.includes("b. sc. life") || p.includes("b.sc. physical") || p.includes("physical science courses") || p.includes("b.sc. polymer")) {
      groups["B.Sc. (Programme)"].push(prog);
    } else if (p.includes("b.com") || p.includes("b. com")) {
      groups["B.Com."].push(prog);
    } else if (p.includes("b.voc") || p.includes("b. voc") || p.includes("vocational") || p.includes("v.s.")) {
      groups["B.Voc. / Vocational"].push(prog);
    } else if (p.includes("bba") || p.includes("bachelor of business") || p.includes("bms") || p.includes("bachelor of management") || p.includes("bbe") || p.includes("business economics")) {
      groups["BBA / BMS / BBE"].push(prog);
    } else if (p.includes("b.tech")) {
      groups["B.Tech."].push(prog);
    } else if (p.includes("music") || p.includes("tabla") || p.includes("pakhawaj") || p.includes("hindustani") || p.includes("karnatak")) {
      groups["Music & Performing Arts"].push(prog);
    } else {
      groups["Other"].push(prog);
    }
  }

  return Object.fromEntries(Object.entries(groups).filter(([, v]) => v.length > 0));
}

export type PapersByGrid = {
  semesters: string[];
  paperTypes: string[];
  grid: Record<string, Record<string, DuPypPaper[]>>;
  // grid[semester][paperType] = papers[]
};

const SEMESTER_ORDER = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "Pool"];
const PAPER_TYPE_ORDER = ["DSC", "DSE", "GE", "AEC", "SEC", "VAC", "Academic Track", "Community Outreach", "Compulsory"];

export function getDuPypForProgramme(programme: string): PapersByGrid {
  const papers = allPapers.filter((p) => p.programme === programme);

  const grid: Record<string, Record<string, DuPypPaper[]>> = {};
  const semSet = new Set<string>();
  const typeSet = new Set<string>();

  for (const paper of papers) {
    const sems = paper.semesters.length > 0 ? paper.semesters : ["Pool"];
    for (const sem of sems) {
      semSet.add(sem);
      if (!grid[sem]) grid[sem] = {};
      const type = paper.paperType;
      typeSet.add(type);
      if (!grid[sem][type]) grid[sem][type] = [];
      grid[sem][type].push(paper);
    }
  }

  const semesters = SEMESTER_ORDER.filter((s) => semSet.has(s));
  const paperTypes = PAPER_TYPE_ORDER.filter((t) => typeSet.has(t));

  return { semesters, paperTypes, grid };
}
