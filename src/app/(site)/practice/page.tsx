import type { Metadata } from "next";
import { getRawUnifiedPyqArchive } from "@/lib/pyq-catalog";
import { PracticeClient } from "@/components/practice/practice-client";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

export const metadata: Metadata = {
  title: "Interactive PYQ Practice & Mock Drills | DU PYQ Online",
  description:
    "Test your knowledge and practice with real exam questions and AI-generated step-by-step solutions for DU previous year papers.",
  alternates: { canonical: "/practice" },
};

export const revalidate = 3600;

interface PracticePageProps {
  searchParams: Promise<{
    paperId?: string;
  }>;
}

export default async function PracticePage(props: PracticePageProps) {
  const searchParams = await props.searchParams;
  const papers = await getRawUnifiedPyqArchive();
  
  // 1. Group and map all 15,389 papers into a structured format for the UI filters
  const courseMap = new Map<
    string,
    {
      name: string;
      slug: string;
      subjects: Map<
        string,
        {
          name: string;
          slug: string;
          semester: string | null;
          years: Set<string>;
        }
      >;
    }
  >();

  for (const p of papers) {
    const courseName = p.course;
    if (!courseName) continue;
    const courseSlug = courseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    
    const subjectName = p.subject;
    if (!subjectName) continue;
    const subjectSlug = subjectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    if (!courseMap.has(courseName)) {
      courseMap.set(courseName, {
        name: courseName,
        slug: courseSlug,
        subjects: new Map(),
      });
    }

    const cData = courseMap.get(courseName)!;
    if (!cData.subjects.has(subjectName)) {
      cData.subjects.set(subjectName, {
        name: subjectName,
        slug: subjectSlug,
        semester: p.semesterGroup || null,
        years: new Set(),
      });
    }

    const sData = cData.subjects.get(subjectName)!;
    if (p.yearRange) {
      sData.years.add(p.yearRange);
    }
  }

  // Convert map to array and sort courses alphabetically
  const coursesData = Array.from(courseMap.values())
    .map((c) => ({
      name: c.name,
      slug: c.slug,
      subjects: Array.from(c.subjects.values()).map((s) => ({
        name: s.name,
        slug: s.slug,
        semester: s.semester,
        years: Array.from(s.years),
      })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // 2. Pre-select a specific paper if paperId is passed via URL query
  let preselectedPaper = undefined;
  if (searchParams.paperId) {
    const paper = papers.find((p) => p.id === searchParams.paperId || `upload-${p.id}` === searchParams.paperId || `drive-${p.id}` === searchParams.paperId);
    if (paper) {
      preselectedPaper = {
        course: paper.course,
        semester: paper.semesterGroup || null,
        subject: paper.subject,
        year: paper.yearRange,
      };
    }
  }

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Practice", url: "/practice" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <div className="mb-6 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
          Interactive PYQ Practice Mode
        </h1>
        <p className="mt-2 text-sm text-muted">
          Practice previous year exam papers with self-assessments, logic challenges, and AI-compiled step-by-step solutions.
        </p>
      </div>

      <PracticeClient initialCourses={coursesData} preselectedPaper={preselectedPaper} />
    </div>
  );
}
