import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PracticeClient } from "@/components/practice/practice-client";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

// Practice mode is deliberately scoped to the programs that actually have
// catalogued practice Questions today, not the full 15,000+ paper PYQ
// archive (that's a different, much larger dataset used by /pyq-notes and
// the paper reader — practice mode only ever needs subjects with real
// Question rows). Pulling in the whole archive here was the direct cause of
// /practice taking tens of seconds to multiple minutes to load: it merged
// several large static JSON catalogs plus a handful of DB queries with
// thousands of params, just to build a course/subject dropdown.
//
// Scope: B.Com (Hons) and B.Com (Programme), Semester 1–6 — expand this
// list as more programs/semesters get real question content fed in, rather
// than reopening the whole page to the unscoped archive again.
const PRACTICE_PROGRAM_SLUGS = ["b-com-hons-du-syllabus", "bcom-programme"];
const PRACTICE_MAX_SEMESTER_ORDER = 6;

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

  // One small, targeted query: only subjects that actually have Question
  // rows, within the two scoped programs and semesters 1–6. Raw SQL, not
  // prisma.subject.findMany()/include: the live DB is missing a column
  // (Subject.parentSubjectId) that's in schema.prisma but was never
  // migrated in, which makes any ORM query selecting the full Subject
  // model fail (P2022) — same workaround used in the practice-questions
  // API route and scripts/import-questions-csv.ts.
  const rows = await prisma.$queryRaw<
    {
      programName: string;
      programSlug: string;
      termName: string;
      termOrder: number;
      subjectName: string;
      subjectId: string;
      years: (string | null)[];
    }[]
  >`
    SELECT
      p.name AS "programName",
      p.slug AS "programSlug",
      t.name AS "termName",
      t."order" AS "termOrder",
      s.name AS "subjectName",
      s.id AS "subjectId",
      array_agg(DISTINCT q.years) AS years
    FROM "Program" p
    JOIN "Term" t ON t."programId" = p.id
    JOIN "Subject" s ON s."termId" = t.id
    JOIN "Question" q ON q."subjectId" = s.id
    WHERE p.slug = ANY(${PRACTICE_PROGRAM_SLUGS}) AND t."order" <= ${PRACTICE_MAX_SEMESTER_ORDER}
    GROUP BY p.name, p.slug, t.name, t."order", s.name, s.id
    ORDER BY p.name, t."order", s.name
  `;

  // Group into the same shape PracticeClient already expects.
  const courseMap = new Map<
    string,
    {
      name: string;
      slug: string;
      subjects: Map<string, { name: string; slug: string; semester: string | null; years: Set<string> }>;
    }
  >();

  for (const r of rows) {
    if (!courseMap.has(r.programName)) {
      courseMap.set(r.programName, { name: r.programName, slug: r.programSlug, subjects: new Map() });
    }
    const cData = courseMap.get(r.programName)!;
    if (!cData.subjects.has(r.subjectName)) {
      cData.subjects.set(r.subjectName, {
        name: r.subjectName,
        slug: r.subjectId,
        semester: r.termName,
        years: new Set(),
      });
    }
    const sData = cData.subjects.get(r.subjectName)!;
    // Question.years is a comma-separated string, e.g. "2021,2022,2024".
    r.years.forEach((yearsField) => {
      (yearsField ?? "").split(",").map((y) => y.trim()).filter(Boolean).forEach((y) => sData.years.add(y));
    });
  }

  const coursesData = Array.from(courseMap.values())
    .map((c) => ({
      name: c.name,
      slug: c.slug,
      subjects: Array.from(c.subjects.values()).map((s) => ({
        name: s.name,
        slug: s.slug,
        semester: s.semester,
        years: Array.from(s.years).sort().reverse(),
      })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // paperId deep-linking (from a PYQ paper's "practice this" link) is out
  // of scope now that this page doesn't load the PYQ archive — the course/
  // subject/year combination it would preselect may not even be one of the
  // scoped subjects above. Silently ignoring an unresolvable paperId (no
  // preselection) is preferable to pulling the whole archive back in just
  // for this one param.
  const preselectedPaper = undefined;

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

      <PracticeClient initialCourses={coursesData} preselectedPaper={preselectedPaper} initialTopic={searchParams.topic} />
    </div>
  );
}
