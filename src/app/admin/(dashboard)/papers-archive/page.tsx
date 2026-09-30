export const dynamic = "force-dynamic";
import Link from "next/link";
import { Files, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { getPapersArchiveCourses } from "@/lib/papers-archive-data";

export default async function PapersArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const all = await getPapersArchiveCourses();
  const query = q.trim().toLowerCase();
  const courses = query ? all.filter((c) => c.course.toLowerCase().includes(query)) : all;
  const totalPapers = all.reduce((n, c) => n + c.paperCount, 0);

  return (
    <div className="space-y-8 p-6 sm:p-8">
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-2 text-sm font-bold text-accent">
          <Files size={20} weight="bold" />
          <span>Papers archive</span>
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
          Edit the {totalPapers.toLocaleString("en-IN")}-paper archive
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Everything students see on /papers across {all.length} programmes. Pick a programme to rename,
          combine, move or remove its subjects, or fix individual paper links. Edits are stored separately
          and can always be reset — the original files are never changed.
        </p>
      </div>

      <form className="flex max-w-md items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
        <MagnifyingGlass size={16} className="text-muted" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search programmes…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Programme</th>
              <th className="px-4 py-3 text-right">Papers</th>
              <th className="px-4 py-3 text-right">Subjects</th>
              <th className="px-4 py-3 text-right">Edited</th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.slug} className="border-b border-border/60 last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3 font-semibold text-foreground">{c.course}</td>
                <td className="px-4 py-3 text-right">{c.paperCount.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-right">{c.subjectCount}</td>
                <td className="px-4 py-3 text-right">
                  {c.editedSubjects > 0 ? (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">
                      {c.editedSubjects}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/papers-archive/${c.slug}`}
                    className="text-xs font-bold text-accent hover:underline"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
            {courses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                  No programme matches “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
