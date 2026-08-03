export const dynamic = "force-dynamic";
import Link from "next/link";
import { getRawUnifiedPyqArchive } from "@/lib/pyq-catalog";
import { slugify } from "@/lib/utils";

export default async function ArchiveCustomizePickerPage() {
  const papers = await getRawUnifiedPyqArchive();

  const courses = new Map<string, { slug: string; paperCount: number; subjects: Set<string> }>();
  for (const paper of papers) {
    const entry = courses.get(paper.course) ?? {
      slug: slugify(paper.course),
      paperCount: 0,
      subjects: new Set<string>(),
    };
    entry.paperCount += 1;
    entry.subjects.add(paper.subject.toLocaleLowerCase());
    courses.set(paper.course, entry);
  }

  const sortedCourses = [...courses.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="p-8">
      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight">Customize Full Archive</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Pick a course to rename subjects, force which semester they group under, merge duplicates
          together, or highlight one. Changes apply on top of the underlying data — nothing here touches
          the original library catalog, uploads, or resources.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedCourses.map(([courseName, entry]) => (
            <Link
              key={courseName}
              href={`/admin/archive-customize/${entry.slug}`}
              className="rounded-xl border border-border bg-background px-4 py-3 hover:border-accent hover:bg-accent-soft/40"
            >
              <span className="block text-sm font-semibold">{courseName}</span>
              <span className="mt-1 block text-xs text-muted">
                {entry.paperCount} papers · {entry.subjects.size} subject labels
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
