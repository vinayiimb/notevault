export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowSquareOut, Plus } from "@phosphor-icons/react/dist/ssr";
import {
  findPapersArchiveCourse,
  getAllPapersArchiveCourseNames,
  getPapersArchiveSubjectPapers,
  type PapersArchivePaper,
} from "@/lib/papers-archive-data";
import { addPaperAction, resetPaperAction, savePaperAction } from "@/lib/papers-archive-actions";
import { ArchiveFlash } from "@/components/admin/archive-flash";
import { PapersDatasetBadge } from "@/components/admin/papers-dataset-badge";

function decode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none";
const PAPER_TYPES = ["DSC", "DSE", "GE", "AEC", "SEC", "VAC", "DSE/GE"];

// The editable fields shared by "edit a paper" and "add a paper".
function PaperFields({
  formId,
  paper,
  defaults,
}: {
  formId: string;
  paper?: PapersArchivePaper;
  defaults: { course: string; subject: string; semester: string | null; verified: boolean };
}) {
  const v = paper ?? { ...defaults, yearRange: "", upc: null, paperType: null, pdfUrl: "" };
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-[11px] font-medium text-muted">Subject (papers with the same name group together)</span>
        <input name="subject" form={formId} required defaultValue={v.subject} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-[11px] font-medium text-muted">Programme</span>
        <input name="course" form={formId} required list="papers-archive-courses" defaultValue={v.course} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted">Semester</span>
        <select name="semester" form={formId} defaultValue={v.semester ?? ""} className={inputCls}>
          <option value="">Not specified</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>
              Semester {n}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted">Exam / year</span>
        <input name="yearRange" form={formId} defaultValue={v.yearRange} placeholder="e.g. May-Jun 2025" className={inputCls} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted">Paper code (UPC)</span>
        <input name="upc" form={formId} inputMode="numeric" defaultValue={v.upc ?? ""} className={`${inputCls} font-mono`} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted">Paper type</span>
        <input name="paperType" form={formId} list="papers-archive-types" defaultValue={v.paperType ?? ""} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
        <span className="text-[11px] font-medium text-muted">PDF link (Google Drive or any PDF)</span>
        <input
          name="pdfUrl"
          form={formId}
          type="url"
          required={!paper}
          defaultValue={v.pdfUrl}
          placeholder="https://drive.google.com/file/d/…/view"
          className={`${inputCls} font-mono text-xs`}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted">Shown on</span>
        <select name="dataset" form={formId} defaultValue={v.verified ? "matched" : "noncore"} className={inputCls}>
          <option value="matched">/papers (Matched)</option>
          <option value="noncore">/papers/noncore (Non-core)</option>
        </select>
      </label>
    </div>
  );
}

export default async function PapersArchiveSubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string; subjectKey: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const [{ courseSlug, subjectKey: rawKey }, { ok, err }] = await Promise.all([params, searchParams]);
  const subjectKey = decode(rawKey);
  const course = await findPapersArchiveCourse(courseSlug);
  if (!course) notFound();
  const [data, courseNames] = await Promise.all([
    getPapersArchiveSubjectPapers(course, subjectKey),
    getAllPapersArchiveCourseNames(),
  ]);
  if (!data) notFound();
  const first = data.papers[0];
  const back = (
    <>
      <input type="hidden" name="courseSlug" value={courseSlug} />
      <input type="hidden" name="groupKey" value={subjectKey} />
      <input type="hidden" name="fromPapersPage" value="1" />
    </>
  );

  return (
    <div className="space-y-6 p-6 sm:p-8">
      <div className="border-b border-border pb-6">
        <Link
          href={`/admin/papers-archive/${courseSlug}`}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground"
        >
          <ArrowLeft size={14} weight="bold" /> {course}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">{data.subjectName}</h1>
        <p className="mt-1 text-sm text-muted">
          {data.papers.length} paper{data.papers.length === 1 ? "" : "s"}. Edit any field of a paper — change its
          subject, semester, exam, paper code, programme or page, fix its link, or hide it. Changing the subject or
          programme moves the paper there. Reset puts a paper back to the original Drive catalog.
          {data.combined && " This heading combines several subjects."}
          {data.subjectHidden && " This whole subject is currently hidden from students."}
        </p>
      </div>

      <ArchiveFlash ok={ok} err={err} />

      <datalist id="papers-archive-courses">
        {courseNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id="papers-archive-types">
        {PAPER_TYPES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <div className="space-y-4">
        {data.papers.map((p, i) => {
          const formId = `paper-${i}`;
          return (
            <article
              key={p.id}
              className={`rounded-2xl border border-border p-4 sm:p-5 ${p.hidden ? "bg-red-500/5" : "bg-surface"}`}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="font-semibold text-foreground">{p.yearRange}</p>
                <PapersDatasetBadge matched={p.verified ? 1 : 0} noncore={p.verified ? 0 : 1} />
                {p.added && (
                  <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold text-accent">Added</span>
                )}
                {p.edited && !p.added && (
                  <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[11px] font-bold text-muted">Edited</span>
                )}
                {p.hidden && (
                  <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[11px] font-bold text-red-500">Hidden</span>
                )}
                <a
                  href={p.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  Open PDF <ArrowSquareOut size={13} weight="bold" />
                </a>
              </div>
              {p.fileName && <p className="mb-3 truncate text-[11px] text-muted">{p.fileName}</p>}

              <form id={formId} action={savePaperAction}>
                <input type="hidden" name="paperId" value={p.id} />
                <input type="hidden" name="originalUrl" value={p.originalUrl} />
                {p.added && <input type="hidden" name="added" value="1" />}
                {back}
              </form>
              <PaperFields
                formId={formId}
                paper={p}
                defaults={{ course, subject: p.subject, semester: p.semester, verified: p.verified }}
              />
              {p.pdfUrl !== p.originalUrl && !p.added && (
                <p className="mt-1.5 truncate text-[11px] text-muted">Original link: {p.originalUrl}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-4">
                <button
                  type="submit"
                  form={formId}
                  className="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-accent-foreground transition hover:opacity-90"
                >
                  Save
                </button>
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" name="hidden" form={formId} defaultChecked={p.hidden} className="size-4 accent-red-500" />
                  Hide from students
                </label>
                {p.edited && (
                  <form action={resetPaperAction} className="ml-auto">
                    <input type="hidden" name="paperId" value={p.id} />
                    {p.added && <input type="hidden" name="added" value="1" />}
                    {back}
                    <button type="submit" className="text-xs font-semibold text-red-500 hover:underline">
                      {p.added ? "Delete added paper" : "Reset to original"}
                    </button>
                  </form>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <section className="rounded-2xl border border-dashed border-accent/50 bg-surface p-4 sm:p-5">
        <h2 className="flex items-center gap-1.5 font-medium">
          <Plus size={16} weight="bold" className="text-accent" /> Add a paper
        </h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Adds a paper that isn&apos;t in the Drive catalog. It shows to students straight away. For Google Drive
          links, set sharing to &ldquo;Anyone with the link&rdquo;.
        </p>
        <form id="add-paper" action={addPaperAction}>
          {back}
        </form>
        <PaperFields
          formId="add-paper"
          defaults={{ course, subject: data.subjectName, semester: first?.semester ?? null, verified: first?.verified ?? true }}
        />
        <button
          type="submit"
          form="add-paper"
          className="mt-4 rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-accent-foreground transition hover:opacity-90"
        >
          Add paper
        </button>
      </section>
    </div>
  );
}
