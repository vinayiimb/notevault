import "server-only";
import { prisma } from "@/lib/prisma";
import { categorizeSubject, type SubjectCategory } from "@/lib/subject-category";

export type CoverageFileRef = {
  id: string;
  label: string;
  url: string;
  source: "drive" | "upload";
};

export type CoverageSubjectRow = {
  id: string;
  name: string;
  category: SubjectCategory;
  filesByYear: Record<number, CoverageFileRef[]>;
};

export type CoverageTermSection = {
  id: string;
  name: string;
  order: number;
  subjects: CoverageSubjectRow[];
};

export type UnlinkedDriveSubject = { id: string; name: string; fileCount: number };

export type CourseCoverageData = {
  program: { id: string; name: string };
  years: number[];
  terms: CoverageTermSection[];
  unlinkedDriveSubjects: UnlinkedDriveSubject[];
};

// Drive-synced filenames essentially never carry a real exam year (DU papers
// are named by subject + a paper/roll code, not a date) — the year a paper
// belongs to is really determined by which ExamSession it came from. Reads
// the leading 4-digit year off the session label ("2025-26 (Dec-Jan)
// Question Papers" -> 2025), which also naturally merges a year's two
// sessions (main + supplementary/backlog) into one column, matching how the
// spreadsheet this page mirrors is laid out (one column per calendar year).
export function deriveSessionYear(sessionLabel: string): number | null {
  const match = sessionLabel.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

export async function getCourseCoverageData(programId: string): Promise<CourseCoverageData> {
  const program = await prisma.program.findUniqueOrThrow({
    where: { id: programId },
    select: {
      id: true,
      name: true,
      terms: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          order: true,
          subjects: {
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              resources: {
                where: { type: "PYQ" },
                select: { id: true, title: true, year: true, fileUrl: true, fileName: true },
              },
              driveSubjects: {
                select: {
                  files: {
                    where: { isCourseBooklet: false },
                    select: {
                      id: true,
                      fileName: true,
                      webViewLink: true,
                      link: { select: { session: { select: { label: true } } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const allYears = new Set<number>();
  const terms: CoverageTermSection[] = [];

  for (const term of program.terms) {
    const subjects: CoverageSubjectRow[] = term.subjects.map((subject) => {
      const filesByYear: Record<number, CoverageFileRef[]> = {};

      for (const resource of subject.resources) {
        if (resource.year == null) continue;
        allYears.add(resource.year);
        (filesByYear[resource.year] ??= []).push({
          id: resource.id,
          label: resource.title || resource.fileName,
          url: resource.fileUrl,
          source: "upload",
        });
      }

      for (const driveSubject of subject.driveSubjects) {
        for (const file of driveSubject.files) {
          const year = deriveSessionYear(file.link.session.label);
          if (year == null) continue;
          allYears.add(year);
          (filesByYear[year] ??= []).push({
            id: file.id,
            label: file.fileName,
            url: file.webViewLink,
            source: "drive",
          });
        }
      }

      return { id: subject.id, name: subject.name, category: categorizeSubject(subject.name), filesByYear };
    });

    terms.push({ id: term.id, name: term.name, order: term.order, subjects });
  }

  const currentYear = new Date().getFullYear();
  if (allYears.size === 0) {
    for (let y = currentYear - 4; y <= currentYear; y += 1) allYears.add(y);
  }
  const years = [...allYears].sort((a, b) => b - a);

  const unlinked = await prisma.driveSubject.findMany({
    where: { programId, subjectId: null },
    select: { id: true, name: true, _count: { select: { files: true } } },
    orderBy: { name: "asc" },
  });

  return {
    program: { id: program.id, name: program.name },
    years,
    terms,
    unlinkedDriveSubjects: unlinked.map((u) => ({ id: u.id, name: u.name, fileCount: u._count.files })),
  };
}
