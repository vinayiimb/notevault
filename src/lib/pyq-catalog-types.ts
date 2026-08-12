export type CatalogPaperSource = "library" | "upload" | "notevault" | "drive";

export type CanonicalMappingStatus = "MATCHED" | "CODE_MATCHED" | "ALIAS_MATCHED" | "UNMATCHED";

export type CatalogPaper = {
  id: string;
  yearRange: string;
  semesterGroup: string;
  course: string;
  subject: string;
  semester: string | null;
  pdfUrl: string;
  note: string | null;
  source: CatalogPaperSource;
  fileName?: string;
  highlighted?: boolean;
  originalSubject?: string;
  officialProgramme?: string | null;
  paperType?: string | null;
  courseNumber?: string | null;
  upc?: string | null;
  matchStatus?: "Exact" | "Strong" | "Review" | "Unmatched";
  matchConfidence?: number;
  semesterCheck?: string;
  isShivaji?: boolean;
  isKalindi?: boolean;
  isANDC?: boolean;
  isRamanujan?: boolean;
  college?: "Shivaji" | "Kalindi" | "ANDC" | "Ramanujan" | string;
  // Canonical DU mapping fields
  canonicalProgramme?: string;
  canonicalSubject?: string;
  canonicalCategory?: string;
  canonicalSemester?: string | null;
  canonicalMappingStatus?: CanonicalMappingStatus;
  canonicalUPC?: string;
  canonicalMatchMethod?: string;
};

export const NO_SEMESTER = "Semester not specified";

// Each paper carries its own semester (e.g. library-catalog rows scraped
// per-file, or a NoteVault term's order), so subjects are grouped under a
// semester heading using that value rather than the freeform semesterGroup
// label (which describes a scrape batch like "I,III,V", not one semester).
// Shared between the client archive browser and the server-side combined-
// download route so both group papers into the same subject buckets.
export function semesterLabel(paper: Pick<CatalogPaper, "semester">) {
  const n = Number(paper.semester);
  return Number.isFinite(n) && n > 0 ? `Semester ${n}` : NO_SEMESTER;
}

export type CatalogCoverageCellData = {
  yearRange: string;
  papers: CatalogPaper[];
};

export type CatalogCoverageRow = {
  subject: string;
  semesters: string[];
  cells: CatalogCoverageCellData[];
};

export type CatalogCourseCoverage = {
  course: string;
  courseSlug: string;
  yearRanges: string[];
  semesterGroupsByYear: Record<string, string[]>;
  rows: CatalogCoverageRow[];
};
