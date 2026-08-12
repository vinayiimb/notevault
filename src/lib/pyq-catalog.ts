import rawCatalog from "@/data/ramanujan-pyq-catalog.json";
import rawOfficialArchiveMap from "@/data/archive-official-map.json";
import duProgrammeMappings from "@/data/du-programme-mappings.json";
import rawQuestionBank from "@/data/du-question-bank-full-mapped.json";
import { geographyDriveCatalog } from "@/data/geography-drive-catalog";
import { politicalScienceDriveCatalog } from "@/data/political-science-drive-catalog";
import { duMasterDriveCatalog } from "@/data/du-master-drive-catalog";
import { extractedZipCatalog } from "@/data/extracted-pyq-catalog";
import { bcomDriveCatalog } from "@/data/bcom-drive-catalog";
import { getFullDriveArchiveIndex, getPyqArchiveIndex } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import {
  canonicalSubjectKey,
  preferredSubjectLabel,
} from "@/lib/subject-normalization";
import type {
  CatalogCourseCoverage,
  CatalogPaper,
  CatalogCoverageRow,
} from "@/lib/pyq-catalog-types";

const EXPECTED_SOURCE_ROWS = 2701;
const EXPECTED_DUPLICATE_SESSION_GROUPS = 335;
const LIBRARY_HOST = "library.ramanujancollege.ac.in";

const sourceCatalog = rawCatalog as CatalogPaper[];

type ArchiveOfficialMapRow = {
  id: string;
  websiteSemester: string | null;
  officialProgramme: string | null;
  officialSemester: string | null;
  paperType: string | null;
  officialPaperName: string | null;
  courseNumber: string | null;
  upc: string | null;
  matchStatus: "Exact" | "Strong" | "Review" | "Unmatched";
  confidence: number;
  semesterCheck: string;
  matchNote: string | null;
};

const officialArchiveMap = new Map(
  (rawOfficialArchiveMap as ArchiveOfficialMapRow[]).map((row) => [row.id, row]),
);

const ROMAN_SEMESTERS: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
};

function singleOfficialSemester(value: string | null) {
  if (!value) return null;
  const cleaned = value.trim().toUpperCase().replace(/^SEM(?:ESTER)?\s*/, "");
  if (/^[1-8]$/.test(cleaned)) return cleaned;
  return ROMAN_SEMESTERS[cleaned] ? String(ROMAN_SEMESTERS[cleaned]) : null;
}

function applyOfficialFileMap(paper: CatalogPaper): CatalogPaper {
  const match = officialArchiveMap.get(paper.id);
  if (!match) return { ...paper, matchStatus: "Unmatched", matchConfidence: 0 };

  const safeAutomaticMatch =
    (match.matchStatus === "Exact" || match.matchStatus === "Strong") &&
    match.semesterCheck !== "Conflict" &&
    Boolean(match.officialPaperName);

  return {
    ...paper,
    originalSubject: safeAutomaticMatch ? paper.subject : undefined,
    subject: safeAutomaticMatch ? match.officialPaperName! : paper.subject,
    semester:
      paper.semester ??
      match.websiteSemester ??
      (safeAutomaticMatch ? singleOfficialSemester(match.officialSemester) : null),
    officialProgramme: match.officialProgramme,
    paperType: match.paperType,
    courseNumber: match.courseNumber,
    upc: match.upc,
    matchStatus: match.matchStatus,
    matchConfidence: match.confidence,
    semesterCheck: match.semesterCheck,
    note:
      safeAutomaticMatch && match.matchNote
        ? [paper.note, match.matchNote].filter(Boolean).join(" · ")
        : paper.note,
  };
}

function sessionStart(value: string) {
  return Number(value.match(/\d{4}/)?.[0] ?? 0);
}

export function sortYearRanges(a: string, b: string) {
  return sessionStart(b) - sessionStart(a) || b.localeCompare(a);
}

function validateSourceCatalog() {
  if (sourceCatalog.length !== EXPECTED_SOURCE_ROWS) {
    throw new Error(
      `PYQ catalog integrity failure: expected ${EXPECTED_SOURCE_ROWS} rows, found ${sourceCatalog.length}.`,
    );
  }

  const urls = new Set<string>();
  const duplicateGroups = new Map<string, number>();

  for (const [index, paper] of sourceCatalog.entries()) {
    if (
      !paper.id ||
      !paper.yearRange ||
      !paper.semesterGroup ||
      !paper.course ||
      !paper.subject ||
      !paper.pdfUrl
    ) {
      throw new Error(`PYQ catalog integrity failure: row ${index + 1} is missing a required value.`);
    }

    let url: URL;
    try {
      url = new URL(paper.pdfUrl);
    } catch {
      throw new Error(`PYQ catalog integrity failure: row ${index + 1} has an invalid PDF URL.`);
    }
    if (url.protocol !== "https:" || url.hostname !== LIBRARY_HOST) {
      throw new Error(`PYQ catalog integrity failure: row ${index + 1} points outside the college library.`);
    }
    if (urls.has(paper.pdfUrl)) {
      throw new Error(`PYQ catalog integrity failure: duplicate source URL at row ${index + 1}.`);
    }
    urls.add(paper.pdfUrl);

    const key = [paper.course, paper.subject, paper.yearRange, paper.semesterGroup].join("\u0000");
    duplicateGroups.set(key, (duplicateGroups.get(key) ?? 0) + 1);
  }

  const duplicateSessionGroups = [...duplicateGroups.values()].filter((count) => count > 1).length;
  if (duplicateSessionGroups !== EXPECTED_DUPLICATE_SESSION_GROUPS) {
    throw new Error(
      `PYQ catalog integrity failure: expected ${EXPECTED_DUPLICATE_SESSION_GROUPS} multi-file groups, found ${duplicateSessionGroups}.`,
    );
  }
}

validateSourceCatalog();

export const catalogIntegrity = {
  sourceRows: EXPECTED_SOURCE_ROWS,
  distinctSourceUrls: EXPECTED_SOURCE_ROWS,
  duplicateSessionGroups: EXPECTED_DUPLICATE_SESSION_GROUPS,
} as const;

export function getSourceCatalog() {
  return sourceCatalog;
}

export function getCatalogCourses() {
  const courses = [...new Set(sourceCatalog.map((paper) => paper.course))].sort((a, b) =>
    a.localeCompare(b),
  );
  const entries = courses.map((course) => ({ name: course, slug: slugify(course) }));
  if (new Set(entries.map((entry) => entry.slug)).size !== entries.length) {
    throw new Error("PYQ catalog integrity failure: two course names resolve to the same URL slug.");
  }
  return entries;
}

export function getCatalogCourseBySlug(courseSlug: string) {
  return getCatalogCourses().find((course) => course.slug === courseSlug) ?? null;
}

export async function getFullPyqCatalog(): Promise<CatalogPaper[]> {
  try {
    const uploads = await prisma.catalogPaperUpload.findMany({
      orderBy: { createdAt: "asc" },
    });

    return [
      ...sourceCatalog,
      ...uploads.map(
        (paper): CatalogPaper => ({
          id: `upload-${paper.id}`,
          yearRange: paper.yearRange,
          semesterGroup: paper.semesterGroup,
          course: normalizeArchiveCourseName(paper.course),
          subject: paper.subject,
          semester: paper.semester === null ? null : String(paper.semester),
          pdfUrl: paper.fileUrl,
          note: paper.note,
          source: paper.fileUrl.includes("drive.google.com") ? "drive" : "upload",
          fileName: paper.fileName,
        }),
      ),
    ];
  } catch (err) {
    console.warn("Database unavailable for getFullPyqCatalog, returning sourceCatalog:", err instanceof Error ? err.message : err);
    return sourceCatalog;
  }
}

// Papers from the DU Question Paper Bank scrape (see scripts/du-question-bank/)
// live in their own standalone table, DuQuestionBankPaper — deliberately NOT
// CatalogPaperUpload, so this never mixes into the Full Archive union above
// (getFullPyqCatalog / /pyq-notes). Only rows that actually have a PDF link
// are shown; the rest are syllabus-only matches with nothing to browse to yet.
function duQuestionBankYearRange(session: string | null, year: string | null): string {
  const sessionU = (session ?? "").toUpperCase();
  const y = year ? Number(year) : NaN;
  if (!Number.isFinite(y)) return session ?? year ?? "";
  if (sessionU.includes("NOV") || sessionU.includes("DEC")) return `${y}-${y + 1}`;
  if (sessionU.includes("MAY") || sessionU.includes("JUNE")) return `${y - 1}-${y}`;
  return String(y);
}

export async function getDuQuestionBankPapers(): Promise<CatalogPaper[]> {
  try {
    const rows = rawQuestionBank as any[];
    return rows
      .filter((row) => row.questionPaperLink)
      .map((row, idx): CatalogPaper => {
        const collegeLabel = row.isShivaji ? "[S] Shivaji" : row.isKalindi ? "[K] Kalindi" : row.isANDC ? "[A] ANDC" : (row.college ? `[${row.college[0]}] ${row.college}` : null);
        const note = [
          collegeLabel,
          row.upc ? `UPC ${row.upc}` : null,
          row.paperType,
          row.courseNumber,
          row.questionPaperSession,
          row.questionPaperSet,
          row.questionPaperMarks ? `${row.questionPaperMarks} marks` : null,
        ]
          .filter(Boolean)
          .join(" | ");

        return {
          id: `du-qb-${idx}`,
          yearRange: duQuestionBankYearRange(row.questionPaperSession, row.questionPaperYear),
          semesterGroup: row.semester ? `Semester ${row.semester}` : "Semester Unknown",
          course: normalizeArchiveCourseName(row.officialProgramme),
          subject: row.subjectPaperName,
          semester: row.semester || null,
          pdfUrl: row.questionPaperLink as string,
          note: note || null,
          source: "upload",
          upc: row.upc || null,
          paperType: row.paperType || null,
          courseNumber: row.courseNumber || null,
          isShivaji: !!row.isShivaji,
          isKalindi: !!row.isKalindi,
          isANDC: !!row.isANDC,
          college: row.college || (row.isShivaji ? "Shivaji" : row.isKalindi ? "Kalindi" : row.isANDC ? "ANDC" : undefined),
        };
      });
  } catch (err) {
    console.warn("Error loading getDuQuestionBankPapers from JSON:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function getCoverageCatalogCourses() {
  const papers = await getFullPyqCatalog();
  const courses = [...new Set(papers.map((paper) => paper.course))].sort((a, b) =>
    a.localeCompare(b),
  );
  return courses.map((name) => ({ name, slug: slugify(name) }));
}

// The public Full Archive is the union of:
// 1. all 2,431 official-library catalog links;
// 2. PDFs uploaded through the catalog coverage screen;
// 3. NoteVault's older OCR/read-online papers; and
// 4. files previously synced from exam-session Google Drive folders.
// Nothing is silently de-duplicated: if two sources really contain separate
// files for the same subject/session, the browser presents them as options.
// This is the RAW union, before admin overrides (rename/semester/merge/
// highlight, see CatalogSubjectOverride) are applied — the admin editor
// reads this directly so it can show what a subject looked like originally.
// Some sources build `course` from the live Program table's name
// (readOnlinePapers/sessionPapers below), while the static library catalog
// uses its own fixed spelling — so the same programme can arrive under two
// different strings (e.g. Program "B.Com. (Hons.)" vs catalog "B. Com.
// (H)"), splitting it into two unrelated course buckets in the archive
// browser and making merged subjects in one bucket invisible from the
// other. This canonicalizes known aliases onto the static catalog's
// spelling so every source lands in the same bucket.
const ARCHIVE_COURSE_ALIASES: Record<string, string> = {
  "b.com. (hons.)": "B. Com. (H)",
  "b.com (hons.)": "B. Com. (H)",
  "b.com. (h)": "B. Com. (H)",
  "b.com (h)": "B. Com. (H)",
  "b.com. programme": "B. Com. (P)",
  "b.com programme": "B. Com. (P)",
  "b.com. (prog.)": "B. Com. (P)",
  "b.com (prog.)": "B. Com. (P)",
  "b.com. (p)": "B. Com. (P)",
  "b.com (p)": "B. Com. (P)",
  "b.a. (h) economics": "Economics",
  "b.a. (h) history": "History",
  "b.a. (h) political science": "Political Science",
  "b.a. (programme) political science": "Political Science",
  "b.a. programme": "B.A. (P)",
  "b.a. program": "B.A. (P)",
  "b.a. (prog)": "B.A. (P)",
  "b.a. (prog.)": "B.A. (P)",
  "b.sc. (h) mathematics": "Mathematics",
  "b.sc. (h) botany": "Another Question Papers",
  "b.sc. (h) chemistry": "Another Question Papers",
  "b.sc. (h) physics": "Another Question Papers",
  "b.sc. (h) zoology": "Another Question Papers",
  "b.sc. (h) environmental science": "Environmental Science",
  "common programme group": "Another Question Papers",
  "other political science courses": "Political Science",
};

function normalizeArchiveCourseName(course: string): string {
  if (!course) return "General / Interdisciplinary";
  return course.trim();
}

export async function getRawUnifiedPyqArchive(): Promise<CatalogPaper[]> {
  const [catalog, readOnline, driveFiles, duQbPyp] = await Promise.all([
    getFullPyqCatalog(),
    getPyqArchiveIndex(),
    getFullDriveArchiveIndex(),
    getDuQuestionBankPapers(),
  ]);

  const readOnlinePapers: CatalogPaper[] = readOnline.map((paper) => ({
    id: `notevault-${paper.id}`,
    yearRange: paper.academicYear ?? (paper.year ? String(paper.year) : "Year not set"),
    semesterGroup: paper.subject.term.name,
    course: paper.subject.term.program.name,
    subject: paper.subject.name,
    semester: paper.subject.term.order ? String(paper.subject.term.order) : null,
    pdfUrl: `/pyq-notes/${paper.id}`,
    note: "Read online",
    source: "notevault",
    fileName: paper.title,
  }));

  const sessionPapers: CatalogPaper[] = driveFiles.flatMap((paper) => {
    if (!paper.driveSubject) return [];
    return [
      {
        id: `drive-${paper.id}`,
        yearRange: paper.link.session.label,
        semesterGroup: paper.link.variantLabel || "Exam-session archive",
        course: paper.driveSubject.program.name,
        subject: paper.driveSubject.name,
        semester: null,
        pdfUrl: paper.webViewLink,
        note: "Google Drive",
        source: "drive",
        fileName: paper.fileName,
      },
    ];
  });

  return [
    ...catalog,
    ...readOnlinePapers,
    ...sessionPapers,
    ...geographyDriveCatalog,
    ...politicalScienceDriveCatalog,
    ...duMasterDriveCatalog,
    ...extractedZipCatalog,
    ...bcomDriveCatalog,
    ...duQbPyp,
  ].map((paper) => ({ ...paper, course: normalizeArchiveCourseName(paper.course) }));
}

function overrideMapKey(course: string, subjectKey: string) {
  return `${course} ${subjectKey}`;
}

export async function getCatalogSubjectOverrides() {
  try {
    return await prisma.catalogSubjectOverride.findMany({ orderBy: { updatedAt: "desc" } });
  } catch (err) {
    console.warn("Database unavailable for getCatalogSubjectOverrides, returning empty array:", err instanceof Error ? err.message : err);
    return [];
  }
}

async function getOverridesByKey() {
  const rows = await getCatalogSubjectOverrides();
  const map = new Map<string, (typeof rows)[number]>();
  for (const row of rows) map.set(overrideMapKey(row.course, row.subjectKey), row);
  return map;
}

function applyOverride(
  paper: CatalogPaper,
  overrides: Map<string, { displayName: string | null; semesterOverride: number | null; highlight: boolean }>,
): CatalogPaper {
  // Overrides are keyed by canonicalSubjectKey(originalSubject ?? subject) —
  // the same basis the admin editor uses (getArchiveSubjectGroupsForCourse)
  // — because applyOfficialFileMap runs before this and can already have
  // rewritten `subject` to an official name, which would otherwise compute
  // a different key than the one the admin actually merged.
  const override = overrides.get(overrideMapKey(paper.course, canonicalSubjectKey(paper.originalSubject ?? paper.subject)));
  if (!override) return paper;
  return {
    ...paper,
    subject: override.displayName || paper.subject,
    semester: override.semesterOverride != null ? String(override.semesterOverride) : paper.semester,
    highlighted: override.highlight || undefined,
  };
}

// The public-facing archive: raw union with admin overrides layered on top.
export async function getUnifiedPyqArchive(): Promise<CatalogPaper[]> {
  const [papers, overrides] = await Promise.all([
    getRawUnifiedPyqArchive(),
    getOverridesByKey(),
  ]);
  return papers.map((p) => {
    const o = applyOverride(applyOfficialFileMap(p), overrides);
    return {
      id: o.id,
      yearRange: o.yearRange,
      semesterGroup: o.semesterGroup,
      course: o.course,
      subject: o.subject,
      semester: o.semester,
      pdfUrl: o.pdfUrl,
      note: o.note,
      source: o.source,
      fileName: o.fileName,
      highlighted: o.highlighted,
      isShivaji: o.isShivaji,
      isKalindi: o.isKalindi,
      isANDC: o.isANDC,
      college: o.college,
    };
  });
}

export function isCatalogCourseSubject(course: string, subject: string) {
  return sourceCatalog.some((paper) => paper.course === course && paper.subject === subject);
}

export function getCatalogYearRanges() {
  return [...new Set(sourceCatalog.map((paper) => paper.yearRange))].sort(sortYearRanges);
}

export function getSemesterGroupsForYear(yearRange: string) {
  return [
    ...new Set(
      sourceCatalog
        .filter((paper) => paper.yearRange === yearRange)
        .map((paper) => paper.semesterGroup),
    ),
  ].sort();
}

export async function getCatalogCourseCoverage(
  courseSlug: string,
): Promise<CatalogCourseCoverage | null> {
  const allCatalogPapers = await getFullPyqCatalog();
  const coverageCatalogPapers = allCatalogPapers.filter(
    (paper) => paper.yearRange !== "Study Material",
  );
  const courseEntry =
    (await getCoverageCatalogCourses()).find((course) => course.slug === courseSlug) ?? null;
  if (!courseEntry) return null;

  const allPapers = coverageCatalogPapers.filter(
    (paper) => paper.course === courseEntry.name,
  );
  const yearRanges = [...new Set(coverageCatalogPapers.map((paper) => paper.yearRange))].sort(
    sortYearRanges,
  );
  const semesterGroupsByYear = Object.fromEntries(
    yearRanges.map((yearRange) => [
      yearRange,
      [
        ...new Set(
          coverageCatalogPapers
            .filter((paper) => paper.yearRange === yearRange)
            .map((paper) => paper.semesterGroup),
        ),
      ].sort(),
    ]),
  );
  const subjectVariants = new Map<string, string[]>();
  for (const paper of allPapers) {
    const key = canonicalSubjectKey(paper.subject);
    const variants = subjectVariants.get(key);
    if (variants) variants.push(paper.subject);
    else subjectVariants.set(key, [paper.subject]);
  }

  const rows: CatalogCoverageRow[] = [...subjectVariants.entries()]
    .map(([subjectKey, variants]) => {
    const subject = preferredSubjectLabel(variants);
    const subjectPapers = allPapers.filter(
      (paper) => canonicalSubjectKey(paper.subject) === subjectKey,
    );
    const semesters = [
      ...new Set(subjectPapers.map((paper) => paper.semester).filter((value): value is string => !!value)),
    ].sort((a, b) => Number(a) - Number(b));
      return {
      subject,
      semesters,
      cells: yearRanges.map((yearRange) => ({
        yearRange,
        papers: subjectPapers.filter((paper) => paper.yearRange === yearRange),
      })),
      };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject));

  return {
    course: courseEntry.name,
    courseSlug: courseEntry.slug,
    yearRanges,
    semesterGroupsByYear,
    rows,
  };
}
