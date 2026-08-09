import { notFound } from "next/navigation";
import { ArrowLeft, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { getCatalogCourseBySlug } from "@/lib/pyq-catalog";
import { getArchiveSubjectGroupsForCourse } from "@/lib/archive-customize-data";
import {
  mergeCatalogSubjectsAction,
  resetCatalogSubjectOverrideAction,
  upsertCatalogSubjectOverrideAction,
} from "@/lib/actions";
import { MERGE_TARGET_SEP } from "@/lib/archive-customize-constants";
import { ManualSubjectMerge } from "@/components/admin/archive-customize/manual-subject-merge";

export const dynamic = "force-dynamic";

export default async function ArchiveCustomizeCoursePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const course = getCatalogCourseBySlug(courseSlug);
  if (!course) notFound();

  const detail = await getArchiveSubjectGroupsForCourse(course.name, courseSlug);

  return (
    <div className="space-y-8 p-6 sm:p-8">
      <div className="border-b border-border pb-6">
        <Link href="/admin/archive-customize" className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground">
          <ArrowLeft size={14} weight="bold" /> All programmes
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">{course.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {detail.allSubjects.length} distinct subject name(s) across the Full Archive for this programme.
        </p>
      </div>

      {/* Candidate duplicate groups */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">Possible duplicate groups</h2>
        {detail.candidateGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
            No likely duplicate subject names found for this programme.
          </div>
        ) : (
          detail.candidateGroups.map((group, i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${group.exact ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                  {group.exact ? "Exact match" : "Possible match"}
                </span>
                <span className="text-xs text-muted">{group.score}% similarity</span>
              </div>
              <ul className="mt-3 space-y-1.5">
                {group.members.map((m) => (
                  <li key={m.subjectKey} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-foreground">
                      {m.displayName}
                      {m.hasOverride && <span className="ml-1.5 text-[10px] font-bold text-accent">(renamed)</span>}
                    </span>
                    <span className="text-xs text-muted">
                      {m.paperCount} paper{m.paperCount === 1 ? "" : "s"}
                      {m.rawVariants.length > 1 && ` · ${m.rawVariants.length} spelling variants`}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <span className="text-xs text-muted">Merge all of the above into:</span>
                <MergeButtons group={group} course={detail.course} courseSlug={detail.courseSlug} />
              </div>
            </div>
          ))
        )}
      </section>

      <ManualSubjectMerge course={detail.course} courseSlug={detail.courseSlug} allSubjects={detail.allSubjects} />

      {/* Full subject list with manual rename/reset */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">All subjects in this programme</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2 text-right">Papers</th>
                <th className="px-4 py-2">Rename / semester override</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {detail.allSubjects.map((s) => (
                <tr key={s.subjectKey} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2 font-semibold text-foreground">
                    {s.displayName}
                    {s.rawVariants.length > 1 && (
                      <p className="text-[11px] font-normal text-muted">Also seen as: {s.rawVariants.filter((v) => v !== s.displayName).join(", ")}</p>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{s.paperCount}</td>
                  <td className="px-4 py-2">
                    <form action={upsertCatalogSubjectOverrideAction} className="flex items-center gap-2">
                      <input type="hidden" name="course" value={detail.course} />
                      <input type="hidden" name="courseSlug" value={detail.courseSlug} />
                      <input type="hidden" name="subjectKey" value={s.subjectKey} />
                      <input
                        name="displayName"
                        defaultValue={s.displayName}
                        className="w-48 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                      />
                      <input
                        name="semester"
                        type="number"
                        min={1}
                        max={8}
                        defaultValue={s.semesterOverride ?? undefined}
                        placeholder="Sem"
                        className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                      />
                      <button type="submit" className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold hover:bg-surface-muted">
                        Save
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-2">
                    {s.hasOverride && s.overrideId && (
                      <form action={resetCatalogSubjectOverrideAction}>
                        <input type="hidden" name="id" value={s.overrideId} />
                        <input type="hidden" name="courseSlug" value={detail.courseSlug} />
                        <button type="submit" className="text-[11px] font-semibold text-red-500 hover:underline">
                          Reset
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-5 text-xs text-muted">
        <Warning size={18} weight="bold" className="mt-0.5 shrink-0 text-accent" />
        <p>
          This tool never moves or deletes files — it only changes how subject names group together in the Full
          Archive browser (/pyq-notes). It&apos;s a separate system from the Subject Normalization Centre, which
          handles the database-backed catalogue (Programs/Terms/Subjects) instead.
        </p>
      </div>
    </div>
  );
}

function MergeButtons({
  group,
  course,
  courseSlug,
}: {
  group: { members: { subjectKey: string; displayName: string; semesterOverride: number | null }[] };
  course: string;
  courseSlug: string;
}) {
  // Each button is its own tiny form (Server Actions need exactly one
  // (subjectKey[], mergeTarget) submission per click) — rendered as
  // separate inline forms rather than one shared form with multiple
  // hidden "subjectKey" inputs, since the merge target itself must be
  // excluded from its own "subjectKey" list.
  return (
    <>
      {group.members.map((target) => (
        <form key={target.subjectKey} action={mergeCatalogSubjectsAction} className="contents">
          <input type="hidden" name="course" value={course} />
          <input type="hidden" name="courseSlug" value={courseSlug} />
          {group.members
            .filter((m) => m.subjectKey !== target.subjectKey)
            .map((m) => (
              <input key={m.subjectKey} type="hidden" name="subjectKey" value={m.subjectKey} />
            ))}
          <input
            type="hidden"
            name="mergeTarget"
            value={`${target.subjectKey}${MERGE_TARGET_SEP}${target.displayName}${MERGE_TARGET_SEP}${target.semesterOverride ?? ""}`}
          />
          <button
            type="submit"
            className="rounded-lg border border-accent/40 bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent hover:bg-accent hover:text-accent-foreground"
          >
            {target.displayName}
          </button>
        </form>
      ))}
    </>
  );
}
