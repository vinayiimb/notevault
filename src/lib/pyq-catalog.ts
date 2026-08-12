import "server-only";
import rawCatalog from "@/data/ramanujan-pyq-catalog.json";
import rawOfficialArchiveMap from "@/data/archive-official-map.json";
import { geographyDriveCatalog } from "@/data/geography-drive-catalog";
import { politicalScienceDriveCatalog } from "@/data/political-science-drive-catalog";
import { duMasterDriveCatalog } from "@/data/du-master-drive-catalog";
import { extractedZipCatalog } from "@/data/extracted-pyq-catalog";
import { bcomDriveCatalog } from "@/data/bcom-drive-catalog";
import { getFullDriveArchiveIndex, getPyqArchiveIndex, type PyqArchiveScope } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { recordQueryDiagnostic } from "@/lib/query-diagnostics";
import { slugify } from "@/lib/utils";
import {
  canonicalSubjectKey,
  preferredSubjectLabel,
} from "@/lib/subject-normalization";
import { enrichPapersWithCanonical } from "@/lib/du-canonical-enrichment";
import type {
  CatalogCourseCoverage,
  CatalogPaper,
  CatalogCoverageRow,
} from "@/lib/pyq-catalog-types";

const EXPECTED_SOURCE_ROWS = 2431;
const EXPECTED_DUPLICATE_SESSION_GROUPS = 315;
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
          course: paper.course,
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
//
// `scope` narrows the two Postgres-backed sources (getPyqArchiveIndex,
// getFullDriveArchiveIndex) to a single subject/programme instead of
// scanning every PYQ resource and every synced Drive file on the site.
// The static, bundled-at-build sources (sourceCatalog + the geography/
// political-science/du-master/extracted-zip/bcom catalogs) are never a
// database round trip either way, so they're left unfiltered here — callers
// that need a subset (see /subjects/[id]) filter them in memory afterwards,
// exactly as before scoping existed. See docs/PHASE_2_QUERY_REMEDIATION.md
// item 1 for the full before/after.
export async function getRawUnifiedPyqArchive(scope: PyqArchiveScope = {}): Promise<CatalogPaper[]> {
  const [catalog, readOnline, driveFiles] = await Promise.all([
    getFullPyqCatalog(),
    getPyqArchiveIndex(scope),
    getFullDriveArchiveIndex(scope),
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
  ];
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
  const override = overrides.get(overrideMapKey(paper.course, canonicalSubjectKey(paper.subject)));
  if (!override) return paper;
  return {
    ...paper,
    subject: override.displayName || paper.subject,
    semester: override.semesterOverride != null ? String(override.semesterOverride) : paper.semester,
    highlighted: override.highlight || undefined,
  };
}

// The public-facing archive: raw union with admin overrides layered on top.
// Pass a `scope` (subjectName and/or programName) to get back only the
// papers that could plausibly match — see getRawUnifiedPyqArchive above for
// what is and isn't pushed down to Postgres. Callers still need to do their
// own final filter over the (now much smaller) result, exactly as before —
// scoping is an optimization, not a replacement for the existing
// subject.upc / subject.name matching logic in each caller.
export async function getUnifiedPyqArchive(scope: PyqArchiveScope = {}): Promise<CatalogPaper[]> {
  return recordQueryDiagnostic("getUnifiedPyqArchive", async () => {
    const [papers, overrides] = await Promise.all([
      getRawUnifiedPyqArchive(scope),
      getOverridesByKey(),
    ]);
    const enriched = enrichPapersWithCanonical(
      papers.map(applyOfficialFileMap).map((paper) => applyOverride(paper, overrides)),
    );
    return enriched;
  });
}

export type ArchiveFilters = {
  /** Program.name — accepts "course" as an alias since that's this file's
   * existing terminology (CatalogPaper.course). */
  programme?: string;
  course?: string;
  /** CatalogPaper.semester, e.g. "3". */
  semester?: string;
  /** CatalogPaper.subject (exact, case-insensitive). */
  subject?: string;
  /** Matches anywhere in CatalogPaper.yearRange, e.g. "2023" or "2023-24". */
  year?: string;
  /** CatalogPaper.paperType — only populated for official-library-matched
   * rows (see applyOfficialFileMap); DB-backed rows won't match this. */
  paperType?: string;
  /** Exam session label — matches CatalogPaper.yearRange for drive-sourced rows. */
  examSession?: string;
  /** Free-text substring match over subject/course/file name. */
  search?: string;
  page?: number;
  pageSize?: number;
};

export type PaginatedArchiveResult = {
  items: CatalogPaper[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const DEFAULT_ARCHIVE_PAGE_SIZE = 20;
const MAX_ARCHIVE_PAGE_SIZE = 50;

// General-purpose filtered + paginated read of the unified archive, per
// docs/PHASE_2_QUERY_REMEDIATION.md item 1. `programme`/`subject` are
// pushed into Postgres via getUnifiedPyqArchive's scope (see above); the
// rest (semester/year/paperType/examSession/search) run in memory over
// that already-narrowed result, because the archive is a union of one
// static, bundled-at-build catalog and several database tables with
// app-level de-duplication and admin overrides layered on top — there's no
// single SQL table to push a LIMIT/OFFSET into across all of that. The
// existing /pyq-notes browse page keeps using the cached full-array
// getUnifiedPyqArchive() (see that page for why — its client-side grouping
// UI is out of scope for a rewrite here); this function is the reusable
// primitive for any *new* filtered/paginated surface (e.g. a future
// /api/pyq-archive route) without repeating the "fetch everything, filter
// in the browser" pattern the audit flagged.
export async function getPaginatedPyqArchive(
  filters: ArchiveFilters = {},
): Promise<PaginatedArchiveResult> {
  const programme = filters.programme ?? filters.course;
  const papers = await getUnifiedPyqArchive({
    programName: programme,
    subjectName: filters.subject,
  });

  const search = filters.search?.trim().toLowerCase();
  const filtered = papers.filter((paper) => {
    if (programme && paper.course !== programme) return false;
    if (filters.subject && paper.subject.toLowerCase() !== filters.subject.toLowerCase()) return false;
    if (filters.semester && paper.semester !== filters.semester) return false;
    if (filters.year && !paper.yearRange.includes(filters.year)) return false;
    if (filters.paperType && paper.paperType !== filters.paperType) return false;
    if (filters.examSession && paper.yearRange !== filters.examSession) return false;
    if (search) {
      const haystack = `${paper.subject} ${paper.course} ${paper.fileName ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const pageSize = Math.min(
    Math.max(Math.trunc(filters.pageSize ?? DEFAULT_ARCHIVE_PAGE_SIZE) || DEFAULT_ARCHIVE_PAGE_SIZE, 1),
    MAX_ARCHIVE_PAGE_SIZE,
  );
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(Math.trunc(filters.page ?? 1) || 1, 1), totalPages);
  const start = (page - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
  };
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
