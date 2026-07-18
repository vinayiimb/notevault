import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, NotePencil } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import {
  createQuestionAction,
  deleteQuestionAction,
  deleteResourceAction,
  updateSubjectNotesAction,
  uploadResourceFormAction,
} from "@/lib/actions";
import { formatBytes } from "@/lib/utils";
import { PdfDropzone } from "@/components/admin/pdf-dropzone";

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

  return (
    <div className="p-8">
      <p className="text-sm text-muted">
        <Link href={`/admin/programs/${subject.term.programId}`} className="hover:text-accent">
          {subject.term.program.name} · {subject.term.name}
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">{subject.name}</h1>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <NotePencil size={18} weight="bold" className="text-sky-dark" />
          Compiled notes
        </h2>
        <p className="mt-1 text-sm text-muted">
          Paste text (plain or markdown — bold section headings like{" "}
          <strong>**I. Section Title**</strong> become real headings automatically). Shown on
          the public subject page as a styled notes page, separate from uploaded PDFs. Leave
          blank and save to remove it.
        </p>
        <form action={updateSubjectNotesAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="subjectId" value={subject.id} />
          <textarea
            name="content"
            defaultValue={subject.notes?.content ?? ""}
            rows={10}
            placeholder="Paste your notes here..."
            className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            Save notes
          </button>
        </form>
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
              <form action={deleteQuestionAction}>
                <input type="hidden" name="id" value={q.id} />
                <input type="hidden" name="subjectId" value={subject.id} />
                <button type="submit" className="shrink-0 text-xs text-red-500 hover:underline">
                  Delete
                </button>
              </form>
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
