export function generateStaticParams() { return []; }
export const dynamicParams = true;
export const dynamic = "force-static";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  mergeCatalogSubjectsAction,
  resetCatalogSubjectOverrideAction,
  upsertCatalogSubjectOverrideAction,
} from "@/lib/actions";
import { getCatalogSubjectOverrides, getRawUnifiedPyqArchive } from "@/lib/pyq-catalog";
import {
  canonicalSubjectKey,
  preferredSubjectLabel,
} from "@/lib/subject-normalization";
import { slugify } from "@/lib/utils";

// Delimiter used to pack a merge target's key/name/semester into a single
// <select> option value — a plain form (no client JS on this page) can only
// submit one string per field, so mergeCatalogSubjectsAction splits this
// one "mergeTarget" field back into its three parts server-side.  is
// a control character, safe against ever appearing in a real subject name.
const MERGE_SEP = "";

type SubjectRow = {
  subjectKey: string;
  rawLabels: string[];
  resolvedName: string;
  semesters: Set<string>;
  paperCount: number;
  overrideId: string | null;
  currentDisplayName: string;
  currentSemester: string;
  currentHighlight: boolean;
};

function majoritySemester(semesters: string[]) {
  if (semesters.length === 0) return "";
  const counts = new Map<string, number>();
  for (const s of semesters) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export default async function ArchiveCustomizeCoursePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const [papers, overrides] = await Promise.all([
    getRawUnifiedPyqArchive(),
    getCatalogSubjectOverrides(),
  ]);

  const coursePapers = papers.filter((paper) => slugify(paper.course) === courseSlug);
  if (coursePapers.length === 0) notFound();
  const course = coursePapers[0].course;
  const courseOverrides = overrides.filter((o) => o.course === course);
  const overrideByKey = new Map(courseOverrides.map((o) => [o.subjectKey, o]));

  const grouped = new Map<
    string,
    { rawLabels: Set<string>; semesters: string[]; paperCount: number }
  >();
  for (const paper of coursePapers) {
    const key = canonicalSubjectKey(paper.subject);
    const entry = grouped.get(key) ?? { rawLabels: new Set<string>(), semesters: [], paperCount: 0 };
    entry.rawLabels.add(paper.subject);
    if (paper.semester) entry.semesters.push(paper.semester);
    entry.paperCount += 1;
    grouped.set(key, entry);
  }

  const rows: SubjectRow[] = [...grouped.entries()]
    .map(([subjectKey, entry]) => {
      const override = overrideByKey.get(subjectKey);
      const rawLabels = [...entry.rawLabels];
      const naturalName = preferredSubjectLabel(rawLabels);
      const naturalSemester = majoritySemester(entry.semesters);
      return {
        subjectKey,
        rawLabels,
        resolvedName: override?.displayName || naturalName,
        semesters: new Set(entry.semesters),
        paperCount: entry.paperCount,
        overrideId: override?.id ?? null,
        currentDisplayName: override?.displayName || naturalName,
        currentSemester: String(override?.semesterOverride ?? naturalSemester ?? ""),
        currentHighlight: override?.highlight ?? false,
      };
    })
    .sort((a, b) => a.resolvedName.localeCompare(b.resolvedName));

  return (
    <div className="p-8">
      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <p className="text-sm text-muted">
          <Link href="/admin/archive-customize" className="hover:text-accent">
            Customize Full Archive
          </Link>
        </p>
        <p className="mt-6 text-xs font-semibold text-accent">Course</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{course}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          {rows.length} subject{rows.length === 1 ? "" : "s"} as they currently appear on the Full Archive
          page. Rename a subject, force its semester, merge it into another one, or highlight it — changes
          show up on /pyq-notes immediately.
        </p>

        <div className="mt-8 space-y-3">
          {rows.map((row) => (
            <div key={row.subjectKey} className="rounded-xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{row.resolvedName}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {row.paperCount} paper{row.paperCount === 1 ? "" : "s"}
                    {row.semesters.size > 0 ? ` · scraped as Semester ${[...row.semesters].sort().join(", ")}` : ""}
                    {row.overrideId ? " · customized" : ""}
                  </p>
                  {row.rawLabels.length > 1 && (
                    <p className="mt-1 text-xs text-muted">
                      Original labels: {row.rawLabels.join(" / ")}
                    </p>
                  )}
                </div>
                {row.overrideId && (
                  <form action={resetCatalogSubjectOverrideAction}>
                    <input type="hidden" name="id" value={row.overrideId} />
                    <input type="hidden" name="courseSlug" value={courseSlug} />
                    <button
                      type="submit"
                      className="min-h-9 rounded-lg border border-border px-3 text-xs font-semibold text-muted hover:border-accent hover:text-accent"
                    >
                      Reset to original
                    </button>
                  </form>
                )}
              </div>

              <form
                action={upsertCatalogSubjectOverrideAction}
                className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,0.7fr)_auto_auto] sm:items-end"
              >
                <input type="hidden" name="course" value={course} />
                <input type="hidden" name="subjectKey" value={row.subjectKey} />
                <input type="hidden" name="courseSlug" value={courseSlug} />
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wide">
                    Display name
                  </label>
                  <input
                    name="displayName"
                    defaultValue={row.currentDisplayName}
                    className="mt-1 min-h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wide">
                    Semester
                  </label>
                  <select
                    name="semester"
                    defaultValue={row.currentSemester}
                    className="mt-1 min-h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">Not set</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        Semester {n}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex min-h-10 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="highlight"
                    defaultChecked={row.currentHighlight}
                    className="size-4 rounded border-border"
                  />
                  Highlight
                </label>
                <button
                  type="submit"
                  className="min-h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
                >
                  Save
                </button>
              </form>

              {rows.length > 1 && (
                <form
                  action={mergeCatalogSubjectsAction}
                  className="mt-2 flex flex-wrap items-end gap-3 border-t border-border/60 pt-3"
                >
                  <input type="hidden" name="course" value={course} />
                  <input type="hidden" name="subjectKey" value={row.subjectKey} />
                  <input type="hidden" name="courseSlug" value={courseSlug} />
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wide">
                      Merge into
                    </label>
                    <select
                      name="mergeTarget"
                      defaultValue=""
                      className="mt-1 min-h-10 w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                      required
                    >
                      <option value="" disabled>
                        Choose another subject on this page…
                      </option>
                      {rows
                        .filter((other) => other.subjectKey !== row.subjectKey)
                        .map((other) => (
                          <option
                            key={other.subjectKey}
                            value={`${other.subjectKey}${MERGE_SEP}${other.currentDisplayName}${MERGE_SEP}${other.currentSemester}`}
                          >
                            {other.resolvedName}
                          </option>
                        ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="min-h-10 rounded-lg border border-accent px-4 text-sm font-semibold text-accent hover:bg-accent-soft"
                  >
                    Merge
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
