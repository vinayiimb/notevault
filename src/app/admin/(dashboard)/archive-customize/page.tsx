import Link from "next/link";
import { Sparkle, FolderOpen } from "@phosphor-icons/react/dist/ssr";
import { getArchiveCourseOverview } from "@/lib/archive-customize-data";

export const dynamic = "force-dynamic";

export default async function ArchiveCustomizePage() {
  let courses;
  let loadError: string | null = null;
  try {
    courses = await getArchiveCourseOverview();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load the Full Archive catalogue.";
  }

  return (
    <div className="space-y-8 p-6 sm:p-8">
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-2 text-sm font-bold text-accent">
          <Sparkle size={20} weight="bold" />
          <span>Customize Full Archive</span>
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
          Merge duplicate subjects in the Full Archive
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          The Full Archive (/pyq-notes) groups papers by free-text subject name, separately from the Subject
          Normalization Centre — a paper here isn&apos;t linked to a Subject row, so duplicates need their own
          merge tool. Pick a programme below to review its subject-name groups.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-700 dark:text-red-300">
          <p className="font-bold">Couldn&apos;t load the Full Archive catalogue</p>
          <p className="mt-1 opacity-90">{loadError}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Programme</th>
                <th className="px-4 py-3 text-right">Papers</th>
                <th className="px-4 py-3 text-right">Distinct subjects</th>
                <th className="px-4 py-3 text-right">Possible duplicate groups</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {courses!.map((c) => (
                <tr key={c.courseSlug} className="border-b border-border/60 last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-3 font-semibold text-foreground">{c.course}</td>
                  <td className="px-4 py-3 text-right">{c.paperCount}</td>
                  <td className="px-4 py-3 text-right">{c.distinctSubjectCount}</td>
                  <td className="px-4 py-3 text-right">
                    {c.candidateGroupCount > 0 ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600">
                        {c.candidateGroupCount}
                      </span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/archive-customize/${c.courseSlug}`}
                      className="flex items-center gap-1 text-xs font-bold text-accent hover:underline"
                    >
                      <FolderOpen size={14} weight="bold" /> Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
