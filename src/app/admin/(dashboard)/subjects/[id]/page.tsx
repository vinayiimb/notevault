export function generateStaticParams() { return []; }
export const dynamicParams = true;
export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, NotePencil, Swatches } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import {
  createNoteThemeAction,
  createQuestionAction,
  deleteQuestionAction,
  deleteResourceAction,
  updateSubjectIdentityAction,
  uploadResourceFormAction,
} from "@/lib/actions";
import { DEFAULT_THEME, ThemeValuesSchema } from "@/lib/note-theme";
import { getResolvedThemeForNote } from "@/lib/note-theme-data";
import { StructuredNoteSchema } from "@/lib/note-schema";
import { formatBytes } from "@/lib/utils";
import { PdfDropzone } from "@/components/admin/pdf-dropzone";
import { NotesEditor } from "@/components/admin/notes-editor";
import { MergeSubjectPicker } from "@/components/admin/merge-subject-picker";
import { StructuredNoteGenerator } from "@/components/admin/structured-note-generator";
import { StructuredNoteEditor } from "@/components/admin/structured-note-editor";

export default async function AdminSubjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const subject = await prisma.subject.findUnique({
    where: { id },
    include: {
      term: { include: { program: true } },
      resources: { orderBy: { createdAt: "desc" } },
      questions: { orderBy: { createdAt: "desc" } },
      notes: true,
    },
  });
  if (!subject) notFound();

  const subjectTheme = await prisma.noteTheme.findFirst({
    where: { scope: "SUBJECT", subjectId: subject.id },
  });
  const subjectThemeColors = subjectTheme
    ? (() => {
        const full = ThemeValuesSchema.safeParse(subjectTheme.publishedJson ?? subjectTheme.draftJson);
        return full.success ? full.data.colors : DEFAULT_THEME.colors;
      })()
    : null;

  const resolvedTheme = await getResolvedThemeForNote(subject.id, subject.notes?.id);
  const structuredNote =
    subject.notes?.format === "STRUCTURED" && subject.notes.structuredJson
      ? (() => {
          const parsed = StructuredNoteSchema.safeParse(subject.notes!.structuredJson);
          return parsed.success ? parsed.data : null;
        })()
      : null;

  return (
    <div className="p-8">
      <p className="text-sm text-muted">
        <Link href={`/admin/programs/${subject.term.programId}`} className="hover:text-accent">
          {subject.term.program.name} · {subject.term.name}
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">{subject.name}</h1>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-medium">Official subject identity</h2>
        <p className="mt-1 text-sm text-muted">
          Uploads match this fixed subject by UPC, official name, then approved aliases.
        </p>
        <form action={updateSubjectIdentityAction} className="mt-4 grid gap-3 md:grid-cols-3">
          <input type="hidden" name="subjectId" value={subject.id} />
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            UPC / paper code
            <input name="upc" defaultValue={subject.upc ?? ""} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            Paper type
            <input name="paperType" defaultValue={subject.paperType ?? ""} placeholder="DSC, DSE, SEC, VAC, AEC…" className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            Approved aliases (semicolon-separated)
            <input name="aliases" defaultValue={subject.aliases.join("; ")} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
          </label>
          <button type="submit" className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
            Save official identity
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-medium">Merge duplicate subject</h2>
        <p className="mt-1 text-sm text-muted">
          If this subject was accidentally created twice under a different name, find the correct one
          and merge this into it.
        </p>
        <div className="mt-3">
          <MergeSubjectPicker subjectId={subject.id} subjectName={subject.name} />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <NotePencil size={18} weight="bold" className="text-sky-dark" />
          Compiled notes
        </h2>
        <NotesEditor
          subjectId={subject.id}
          initialContent={subject.notes?.content ?? ""}
          initialTheme={subject.notes?.theme ?? "sky"}
          pyqCount={subject.resources.filter((r) => r.type === "PYQ").length}
          resolvedTheme={resolvedTheme}
        />
        <div className="mt-4">
          <StructuredNoteGenerator subjectId={subject.id} hasStructuredNote={subject.notes?.format === "STRUCTURED"} />
        </div>
        {structuredNote && (
          <StructuredNoteEditor subjectId={subject.id} note={structuredNote} theme={resolvedTheme} />
        )}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <Swatches size={18} weight="bold" className="text-accent" />
          Note design
        </h2>
        <p className="mt-1 text-sm text-muted">
          Fonts (heading, sub-heading, body), colors, and layout for this subject&apos;s structured notes.
          Falls back to the site-wide default until customized here.
        </p>

        {subjectTheme ? (
          <div className="mt-4 flex items-center gap-4">
            <div className="flex overflow-hidden rounded-lg border border-border">
              {[
                subjectThemeColors!.background,
                subjectThemeColors!.primaryAccent,
                subjectThemeColors!.highlightYellow,
                subjectThemeColors!.highlightMint,
                subjectThemeColors!.highlightPink,
              ].map((c, i) => (
                <span key={i} className="h-8 w-8" style={{ backgroundColor: c }} />
              ))}
            </div>
            <Link
              href={`/admin/note-themes/${subjectTheme.id}`}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
            >
              Edit fonts &amp; colors for this subject
            </Link>
          </div>
        ) : (
          <form action={createNoteThemeAction} className="mt-4">
            <input type="hidden" name="scope" value="SUBJECT" />
            <input type="hidden" name="subjectId" value={subject.id} />
            <input type="hidden" name="name" value={`${subject.name} theme`} />
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
            >
              Customize fonts &amp; colors for this subject
            </button>
          </form>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <FileText size={18} weight="bold" className="text-accent" />
          Upload a paper
        </h2>
        <p className="mt-1 text-sm text-muted">
          Add a notes PDF or a previous year question paper for this subject.
        </p>
        <form action={uploadResourceFormAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="subjectId" value={subject.id} />
          <PdfDropzone name="file" required />
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Type</label>
              <select
                name="type"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
              >
                <option value="NOTES">Notes</option>
                <option value="PYQ">PYQ</option>
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Title</label>
              <input
                name="title"
                required
                placeholder="e.g. Unit 3 - Cost Accounting"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Year (PYQ)</label>
              <input
                name="year"
                type="number"
                placeholder="2024"
                className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
            >
              Upload
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-muted">Uploaded files</h2>
        <ul className="mt-3 flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {subject.resources.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="mr-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                    {r.type}
                  </span>
                  {r.title}
                </p>
                <p className="text-xs text-muted">
                  {r.year ? `${r.year} · ` : ""}
                  {formatBytes(r.fileSize)}
                </p>
              </div>
              <form action={deleteResourceAction}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="subjectId" value={subject.id} />
                <button type="submit" className="text-xs text-red-500 hover:underline">
                  Delete
                </button>
              </form>
            </li>
          ))}
          {subject.resources.length === 0 && (
            <li className="p-3 text-sm text-muted">No files uploaded yet.</li>
          )}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-medium">Add question to bank</h2>
        <form
          action={createQuestionAction}
          className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
        >
          <input type="hidden" name="subjectId" value={subject.id} />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Question</label>
            <textarea
              name="questionText"
              required
              rows={2}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Answer</label>
            <textarea
              name="answerText"
              required
              rows={4}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Marks</label>
              <input
                name="marks"
                type="number"
                className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Years appeared</label>
              <input
                name="years"
                placeholder="2021, 2023, 2024"
                className="w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted"># times repeated</label>
              <input
                name="repeatCount"
                type="number"
                defaultValue={1}
                className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" name="isRepeated" className="accent-accent" />
              Mark as frequently repeated
            </label>
          </div>
          <button
            type="submit"
            className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            Add question
          </button>
        </form>

        <ul className="mt-4 flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {subject.questions.map((q) => (
            <li key={q.id} className="flex items-start justify-between gap-4 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{q.questionText}</p>
                <p className="mt-1 text-xs text-muted">
                  {q.isRepeated && (
                    <span className="mr-2 rounded-full bg-accent-soft px-2 py-0.5 text-accent">
                      repeated x{q.repeatCount}
                    </span>
                  )}
                  {q.years && `Years: ${q.years}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Link href={`/admin/questions/${q.id}`} className="text-xs text-accent hover:underline">
                  Edit
                </Link>
                <form action={deleteQuestionAction}>
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="subjectId" value={subject.id} />
                  <button type="submit" className="text-xs text-red-500 hover:underline">
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
          {subject.questions.length === 0 && (
            <li className="p-3 text-sm text-muted">No questions added yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
