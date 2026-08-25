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

export const dynamic = "force-dynamic";

interface PracticePageProps {
  searchParams: Promise<{
    paperId?: string;
    topic?: string;
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

      <div className="mb-6 p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-blue-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white rounded">NEW</span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">IPMAT Indore 2026 – AfterBoards CBT Mock Test</h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Experience the authentic online CBT exam interface with real-time timers, section switching, scientific calculator & palette navigation.
          </p>
        </div>
        <a
          href="/mock-test"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#007bff] hover:bg-blue-600 rounded-lg shadow-xs transition shrink-0"
        >
          Launch Mock Test Console &rarr;
        </a>
      </div>

      <PracticeClient initialCourses={coursesData} preselectedPaper={preselectedPaper} initialTopic={searchParams.topic} />
    </div>
  );
}
