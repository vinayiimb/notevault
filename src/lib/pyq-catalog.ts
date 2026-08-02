import rawCatalog from "@/data/ramanujan-pyq-catalog.json";
import { geographyDriveCatalog } from "@/data/geography-drive-catalog";
import { politicalScienceDriveCatalog } from "@/data/political-science-drive-catalog";
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

const EXPECTED_SOURCE_ROWS = 2431;
const EXPECTED_DUPLICATE_SESSION_GROUPS = 315;
const LIBRARY_HOST = "library.ramanujancollege.ac.in";

const sourceCatalog = rawCatalog as CatalogPaper[];

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
export async function getRawUnifiedPyqArchive(): Promise<CatalogPaper[]> {
  const [catalog, readOnline, driveFiles] = await Promise.all([
    getFullPyqCatalog(),
    getPyqArchiveIndex(),
    getFullDriveArchiveIndex(),
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
  ];
}

function overrideMapKey(course: string, subjectKey: string) {
  return `${course} ${subjectKey}`;
}

export async function getCatalogSubjectOverrides() {
  return prisma.catalogSubjectOverride.findMany({ orderBy: { updatedAt: "desc" } });
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
export async function getUnifiedPyqArchive(): Promise<CatalogPaper[]> {
  const [papers, overrides] = await Promise.all([
    getRawUnifiedPyqArchive(),
    getOverridesByKey(),
  ]);
  return papers.map((paper) => applyOverride(paper, overrides));
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
