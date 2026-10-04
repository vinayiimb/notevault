export const dynamic = "force-dynamic";
import Link from "next/link";
import { Files, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { getPapersArchiveCourses } from "@/lib/papers-archive-data";
import { DATASET_FILTERS, matchesDataset } from "@/components/admin/papers-dataset-badge";

export default async function PapersArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; set?: string }>;
}) {
  const { q = "", set = "" } = await searchParams;
  const all = await getPapersArchiveCourses();
  const query = q.trim().toLowerCase();
  const courses = all.filter(
    (c) => (!query || c.course.toLowerCase().includes(query)) && matchesDataset(set, c.matchedCount, c.paperCount),
  );
  const totalPapers = all.reduce((n, c) => n + c.paperCount, 0);
  const totalMatched = all.reduce((n, c) => n + c.matchedCount, 0);
  const setHref = (s: string) => {
    const params = new URLSearchParams();
    if (s) params.set("set", s);
    if (q) params.set("q", q);
    const qs = params.toString();
    return `/admin/papers-archive${qs ? `?${qs}` : ""}`;
  };

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
          Everything students see across {all.length} programmes —{" "}
          <span className="font-semibold text-emerald-600">{totalMatched.toLocaleString("en-IN")} matched</span> to
          the current syllabus (on /papers) and{" "}
          <span className="font-semibold text-amber-600">
            {(totalPapers - totalMatched).toLocaleString("en-IN")} non-core
          </span>{" "}
          (on /papers/noncore). Pick a programme to rename, combine, move or remove its subjects, or fix
          individual paper links. Edits apply on both pages, are stored separately and can always be reset —
          the original files are never changed.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DATASET_FILTERS.map(([s, label]) => (
          <Link
            key={label}
            href={setHref(s)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              set === s ? "bg-accent text-white" : "bg-surface-muted text-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <form className="flex max-w-md items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
        <MagnifyingGlass size={16} className="text-muted" />
        {set && <input type="hidden" name="set" value={set} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Search programmes…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Programme</th>
              <th className="px-4 py-3 text-right">Papers</th>
              <th className="px-4 py-3 text-right">Matched</th>
              <th className="px-4 py-3 text-right">Non-core</th>
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
                <td className="px-4 py-3 text-right text-emerald-600">{c.matchedCount || "—"}</td>
                <td className="px-4 py-3 text-right text-amber-600">{c.noncoreCount || "—"}</td>
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
                    href={`/admin/papers-archive/${c.slug}${set ? `?set=${set}` : ""}`}
                    className="text-xs font-bold text-accent hover:underline"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
            {courses.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
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
