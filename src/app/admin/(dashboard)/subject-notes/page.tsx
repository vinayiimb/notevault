export const dynamic = "force-dynamic";
import Link from "next/link";
import { NotePencil } from "@phosphor-icons/react/dist/ssr";
import { getProgrammesWithNotesStatus, getReadyNotesByProgramme } from "@/lib/canonical-subject-notes-data";
import { getSiteSettings } from "@/lib/data";
import { updateNotesFeaturedProgrammesFromCheckboxesAction } from "@/lib/actions";

export default async function SubjectNotesOverviewPage() {
  const [all, siteSettings, ready] = await Promise.all([
    getProgrammesWithNotesStatus(),
    getSiteSettings(),
    getReadyNotesByProgramme(),
  ]);
  // Courses with notes first in every list on this page.
  const programmes = [...all].sort((a, b) => b.notesCount - a.notesCount || a.name.localeCompare(b.name));
  const doneCount = ready.reduce((n, p) => n + p.subjects.length, 0);
  const featuredSlugs = new Set(
    siteSettings.notesFeaturedProgrammes
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? []
  );

  return (
    <div className="space-y-8 p-6 sm:p-8">
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-2 text-sm font-bold text-accent">
          <NotePencil size={20} weight="bold" />
          <span>Subject Notes</span>
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
          Deploy study notes by programme &amp; subject
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          The full official list of {programmes.length} DU programmes from the canonical syllabus file. Pick
          one to see its subjects and drop in a finished .md file.
        </p>
      </div>

      {/* Done so far: every subject with a written note, by course (General Notes first) */}
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">Notes done</h2>
          <p className="text-sm text-muted">{doneCount} subject{doneCount === 1 ? "" : "s"} in {ready.length} course{ready.length === 1 ? "" : "s"}</p>
        </div>
        {ready.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No notes written yet.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ready.map((p) => (
              <div key={p.slug} className="rounded-xl border border-border">
                <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-muted px-3.5 py-2.5">
                  <Link href={`/admin/subject-notes/program/${p.slug}`} className="min-w-0 truncate text-sm font-semibold hover:text-accent">{p.name}</Link>
                  <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-xs font-bold text-success">{p.subjects.length} done</span>
                </div>
                <ul className="divide-y divide-border/60">
                  {p.subjects.map((s) => (
                    <li key={s.slug}>
                      <Link href={`/admin/subject-notes/subject/${p.slug}/${s.slug}`} className="flex min-h-10 items-center gap-2 px-3.5 py-2 text-sm hover:bg-surface-muted">
                        <span className="min-w-0 flex-1">{s.name}</span>
                        {s.semester ? <span className="shrink-0 text-xs text-muted">Sem {s.semester}</span> : null}
                        <span className="shrink-0 text-xs font-bold text-accent">Edit</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <form
        method="get"
        action="/admin/subject-notes/subject/general-notes/new"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4"
      >
        <label className="flex-1 text-sm font-medium">
          General note: type a name, then drop the .md file on the next page
          <input
            name="name"
            required
            maxLength={120}
            placeholder="e.g. भारतीय भक्ति परंपरा और मानव मूल्य"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
          Add note →
        </button>
      </form>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-medium">Shown on the public /notes page</h2>
        <p className="mt-1 text-sm text-muted">
          Check the programmes ready for students to browse. Unchecked programmes still exist here for you
          to keep building notes, but stay hidden from the public site.
        </p>
        <form action={updateNotesFeaturedProgrammesFromCheckboxesAction} className="mt-4">
          <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
            <div className="grid grid-cols-1 divide-y divide-border/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              {programmes.map((p) => (
                <label
                  key={p.slug}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface-muted"
                >
                  <input
                    type="checkbox"
                    name="programmeSlug"
                    value={p.slug}
                    defaultChecked={featuredSlugs.has(p.slug)}
                    className="size-4 rounded border-border accent-accent"
                  />
                  <span className="truncate text-foreground">{p.name}</span>
                  {p.notesCount > 0 && (
                    <span className="ml-auto shrink-0 text-xs text-muted">{p.notesCount} notes</span>
                  )}
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            Save visible programmes
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Programme</th>
              <th className="px-4 py-3 text-right">Subjects</th>
              <th className="px-4 py-3 text-right">Notes deployed</th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {programmes.map((p) => (
              <tr key={p.slug} className="border-b border-border/60 last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3 font-semibold text-foreground">{p.name}</td>
                <td className="px-4 py-3 text-right">{p.subjectCount}</td>
                <td className="px-4 py-3 text-right">
                  {p.notesCount > 0 ? (
                    <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-bold text-success">
                      {p.notesCount} / {p.subjectCount}
                    </span>
                  ) : (
                    <span className="text-muted">0 / {p.subjectCount}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/subject-notes/program/${p.slug}`}
                    className="text-xs font-bold text-accent hover:underline"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
