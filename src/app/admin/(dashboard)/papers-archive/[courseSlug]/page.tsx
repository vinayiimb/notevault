export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import {
  findPapersArchiveCourse,
  getAllPapersArchiveCourseNames,
  getPapersArchiveSubjects,
} from "@/lib/papers-archive-data";
import {
  mergePapersSubjectsAction,
  resetPapersSubjectAction,
  updatePapersSubjectAction,
} from "@/lib/papers-archive-actions";
import { ArchiveFlash } from "@/components/admin/archive-flash";

export default async function PapersArchiveCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string }>;
  searchParams: Promise<{ q?: string; ok?: string; err?: string }>;
}) {
  const [{ courseSlug }, { q = "", ok, err }] = await Promise.all([params, searchParams]);
  const course = await findPapersArchiveCourse(courseSlug);
  if (!course) notFound();

  const [allSubjects, courseNames] = await Promise.all([
    getPapersArchiveSubjects(course),
    getAllPapersArchiveCourseNames(),
  ]);
  const query = q.trim().toLowerCase();
  const subjects = query
    ? allSubjects.filter(
        (s) =>
          s.displayName.toLowerCase().includes(query) ||
          s.members.some((m) => m.originalName.toLowerCase().includes(query)),
      )
    : allSubjects;
  const totalPapers = allSubjects.reduce((n, s) => n + s.paperCount, 0);

  return (
    <div className="space-y-6 p-6 sm:p-8">
      <div className="border-b border-border pb-6">
        <Link
          href="/admin/papers-archive"
          className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground"
        >
          <ArrowLeft size={14} weight="bold" /> All programmes
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">{course}</h1>
        <p className="mt-1 text-sm text-muted">
          {allSubjects.length} subjects · {totalPapers.toLocaleString("en-IN")} papers
        </p>
      </div>

      <ArchiveFlash ok={ok} err={err} />

      <datalist id="papers-archive-courses">
        {courseNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-medium">Combine subjects</h2>
        <p className="mt-1 text-sm text-muted">
          Tick two or more subjects in the table below (e.g. the same subject listed under different names),
          then give the combined subject a name. All their papers will show together under that one heading
          on /papers, and here as one row. Use Reset on the combined row to split it again.
        </p>
        <form id="merge-form" action={mergePapersSubjectsAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="course" value={course} />
          <input type="hidden" name="courseSlug" value={courseSlug} />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Combined name</span>
            <input
              name="targetName"
              required
              placeholder="e.g. Financial Accounting"
              className="w-72 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Semester (optional)</span>
            <input
              name="semester"
              type="number"
              min={1}
              max={8}
              className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            Combine ticked subjects
          </button>
        </form>
      </section>

      <form className="flex max-w-md items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
        <MagnifyingGlass size={16} className="text-muted" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search subjects in this programme…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="w-10 px-3 py-3"></th>
              <th className="px-3 py-3">Subject name</th>
              <th className="px-3 py-3">Semester</th>
              <th className="px-3 py-3">Programme</th>
              <th className="px-3 py-3">Remove</th>
              <th className="px-3 py-3 text-right">Papers</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s, i) => {
              const formId = `subject-${i}`;
              return (
                <tr
                  key={s.groupKey}
                  className={`border-b border-border/60 align-top last:border-0 ${s.hidden ? "bg-red-500/5" : ""}`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      name="mergeKeys"
                      value={s.members.map((m) => m.subjectKey).join("\n")}
                      form="merge-form"
                      aria-label={`Select ${s.displayName} to combine`}
                      className="mt-2 size-4 accent-accent"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <form id={formId} action={updatePapersSubjectAction}>
                      <input type="hidden" name="course" value={course} />
                      <input type="hidden" name="courseSlug" value={courseSlug} />
                      <input type="hidden" name="currentName" value={s.displayName} />
                      {s.members.map((m) => (
                        <span key={m.subjectKey}>
                          <input type="hidden" name="subjectKey" value={m.subjectKey} />
                          <input type="hidden" name="originalName" value={m.originalName} />
                        </span>
                      ))}
                    </form>
                    <input
                      name="displayName"
                      form={formId}
                      defaultValue={s.displayName}
                      className="w-full min-w-56 rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                    />
                    {s.members.length > 1 ? (
                      <div className="mt-1.5 text-[11px] leading-4 text-muted">
                        <span className="rounded-full bg-accent-soft px-1.5 py-0.5 font-bold text-accent">
                          Combined · {s.members.length} subjects
                        </span>
                        <ul className="mt-1 list-inside list-disc">
                          {s.members.map((m) => (
                            <li key={m.subjectKey}>
                              {m.originalName} ({m.paperCount})
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      s.displayName !== s.members[0].originalName && (
                        <p className="mt-1 text-[11px] text-muted">Originally: {s.members[0].originalName}</p>
                      )
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <input
                      name="semester"
                      form={formId}
                      type="number"
                      min={1}
                      max={8}
                      defaultValue={s.semesterOverride ?? undefined}
                      placeholder={s.semesters.join(", ") || "—"}
                      className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      name="courseOverride"
                      form={formId}
                      list="papers-archive-courses"
                      defaultValue={s.courseOverride ?? course}
                      className="w-60 rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <label className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                      <input
                        type="checkbox"
                        name="hidden"
                        form={formId}
                        defaultChecked={s.hidden}
                        className="size-4 accent-red-500"
                      />
                      Hide
                    </label>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={`/admin/papers-archive/${courseSlug}/${encodeURIComponent(s.groupKey)}`}
                      className="mt-1.5 inline-block text-xs font-bold text-accent hover:underline"
                    >
                      {s.paperCount} →
                    </Link>
                    {s.editedPapers > 0 && (
                      <p className="mt-1 text-[11px] text-muted">{s.editedPapers} edited</p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        form={formId}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-muted"
                      >
                        Save
                      </button>
                      {s.hasOverride && (
                        <form action={resetPapersSubjectAction}>
                          <input type="hidden" name="course" value={course} />
                          <input type="hidden" name="courseSlug" value={courseSlug} />
                          {s.members.map((m) => (
                            <input key={m.subjectKey} type="hidden" name="subjectKey" value={m.subjectKey} />
                          ))}
                          <button type="submit" className="text-xs font-semibold text-red-500 hover:underline">
                            {s.members.length > 1 ? "Split" : "Reset"}
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {subjects.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                  No subject matches “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
