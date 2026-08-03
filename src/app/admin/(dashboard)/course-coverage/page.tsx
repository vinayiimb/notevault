export const dynamic = "force-static";
import Link from "next/link";
import {
  getCoverageCatalogCourses,
  getFullPyqCatalog,
} from "@/lib/pyq-catalog";

export default async function CourseCoveragePickerPage() {
  const [courses, papers] = await Promise.all([
    getCoverageCatalogCourses(),
    getFullPyqCatalog(),
  ]);

  return (
    <div className="p-8">
      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight">Catalog coverage</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Choose a course from the merged library, Drive, and DU PYQ Online catalog. Each course opens a subject × source-year
          matrix: completed cells are checked, missing cells have a real PDF upload action, and multi-file
          cells retain every option.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const coursePapers = papers.filter((paper) => paper.course === course.name);
            const pyqPapers = coursePapers.filter((paper) => paper.yearRange !== "Study Material");
            const studyFiles = coursePapers.length - pyqPapers.length;
            const subjects = new Set(coursePapers.map((paper) => paper.subject)).size;
            return (
            <Link
              key={course.slug}
              href={`/admin/course-coverage/${course.slug}`}
              className="rounded-xl border border-border bg-background px-4 py-3 hover:border-accent hover:bg-accent-soft/40"
            >
              <span className="block text-sm font-semibold">{course.name}</span>
              <span className="mt-1 block text-xs text-muted">
                {pyqPapers.length} PYQs
                {studyFiles ? ` · ${studyFiles} study files` : ""}
                {" · "}{subjects} subjects
              </span>
            </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
