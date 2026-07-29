export type CatalogPaperSource = "library" | "upload" | "notevault" | "drive";

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
};

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
